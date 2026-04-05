use crate::db::PgPool;
use crate::models::*;
use web_push::*;

struct VapidKeys {
    private: String,
    email: String,
}

fn load_vapid_keys() -> Option<VapidKeys> {
    let private = std::env::var("VAPID_PRIVATE").ok()?;
    let email = std::env::var("VAPID_EMAIL").unwrap_or_else(|_| "admin@ahara.io".to_string());
    Some(VapidKeys { private, email })
}

async fn send_push(
    sub: &PushSubscription,
    keys: &VapidKeys,
    payload: &NotificationPayload,
) -> Result<(), String> {
    let subscription_info = SubscriptionInfo {
        endpoint: sub.endpoint.clone(),
        keys: SubscriptionKeys {
            p256dh: sub.p256dh.clone(),
            auth: sub.auth.clone(),
        },
    };

    let mut builder = WebPushMessageBuilder::new(&subscription_info);
    let content = serde_json::to_string(payload).map_err(|e| e.to_string())?;
    builder.set_payload(ContentEncoding::Aes128Gcm, content.as_bytes());
    builder.set_ttl(3600);

    let mut sig = VapidSignatureBuilder::from_base64(&keys.private, &subscription_info)
        .map_err(|e| format!("{e}"))?;
    sig.add_claim("sub", format!("mailto:{}", keys.email));
    let signature = sig.build().map_err(|e| format!("{e}"))?;
    builder.set_vapid_signature(signature);

    let message = builder.build().map_err(|e| format!("{e}"))?;
    let client = IsahcWebPushClient::new().map_err(|e| format!("{e}"))?;
    client.send(message).await.map_err(|e| format!("{e}"))
}

#[derive(serde::Serialize)]
struct NotificationPayload {
    title: String,
    body: String,
    icon: String,
    tag: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    actions: Vec<NotificationAction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
}

#[derive(serde::Serialize)]
struct NotificationAction {
    action: String,
    title: String,
}

fn time_to_minutes(time_str: &str) -> Option<u32> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    Some(h * 60 + m)
}

fn now_minutes(offset_minutes: i32) -> u32 {
    let utc = chrono::Utc::now();
    let local = utc + chrono::Duration::minutes(offset_minutes as i64);
    (local.format("%H").to_string().parse::<u32>().unwrap_or(0)) * 60
        + local.format("%M").to_string().parse::<u32>().unwrap_or(0)
}

fn effective_date(offset_minutes: i32) -> String {
    let utc = chrono::Utc::now();
    let local = utc + chrono::Duration::minutes(offset_minutes as i64);
    // Before 3 AM counts as previous day
    if local.format("%H").to_string().parse::<u32>().unwrap_or(0) < 3 {
        let prev = local - chrono::Duration::hours(24);
        return prev.format("%Y-%m-%d").to_string();
    }
    local.format("%Y-%m-%d").to_string()
}

/// Check which notifications are due and send them.
pub async fn check_and_send(db: &PgPool, tz_offset: i32) -> Result<String, String> {
    let keys = load_vapid_keys().ok_or("VAPID keys not configured")?;
    let subs = db
        .list_push_subscriptions()
        .await
        .map_err(|e| format!("{e}"))?;
    if subs.is_empty() {
        return Ok("no subscriptions".to_string());
    }

    let settings: NotificationSettings = db
        .get_config("notification_settings")
        .await
        .map_err(|e| format!("{e}"))?
        .unwrap_or_default();
    if !settings.enabled {
        return Ok("notifications disabled".to_string());
    }

    let today = effective_date(tz_offset);
    let now = now_minutes(tz_offset);

    // Load today's state
    let day = db.get_day(&today).await.map_err(|e| format!("{e}"))?;
    let supp_logs = db
        .get_supplement_logs(&today)
        .await
        .map_err(|e| format!("{e}"))?;
    let types = db.list_types().await.map_err(|e| format!("{e}"))?;
    let active_morning: Vec<_> = types
        .iter()
        .filter(|t| t.active && t.timing == "morning")
        .collect();
    let morning_taken = active_morning
        .iter()
        .all(|t| supp_logs.iter().any(|l| l.type_id == t.id && l.taken));

    // Track what we've sent today to avoid duplicates
    let sent_key = format!("notifications_sent_{today}");
    let sent: Vec<String> = db
        .get_config(&sent_key)
        .await
        .map_err(|e| format!("{e}"))?
        .unwrap_or_default();

    let mut payloads: Vec<(String, NotificationPayload)> = Vec::new();

    // Morning doses reminder
    if let Some(t) = time_to_minutes(&settings.morning_doses) {
        if now >= t && !morning_taken && !sent.contains(&"morning_doses".to_string()) {
            payloads.push((
                "morning_doses".to_string(),
                NotificationPayload {
                    title: "Morning supplements".to_string(),
                    body: format!(
                        "{} supplements to take",
                        active_morning
                            .iter()
                            .filter(|t2| !supp_logs.iter().any(|l| l.type_id == t2.id && l.taken))
                            .count()
                    ),
                    icon: "/icon-192.png".to_string(),
                    tag: "morning-doses".to_string(),
                    actions: vec![],
                    data: Some(serde_json::json!({"url": "/"})),
                },
            ));
        }
    }

    // Missed dose nudge (noon)
    if let Some(t) = time_to_minutes(&settings.missed_dose_nudge) {
        if now >= t && !morning_taken && !sent.contains(&"missed_dose".to_string()) {
            payloads.push((
                "missed_dose".to_string(),
                NotificationPayload {
                    title: "Missed doses".to_string(),
                    body: "You haven't logged your morning supplements yet".to_string(),
                    icon: "/icon-192.png".to_string(),
                    tag: "missed-dose".to_string(),
                    actions: vec![],
                    data: Some(serde_json::json!({"url": "/"})),
                },
            ));
        }
    }

    // Energy check-ins
    let energy_checks = [
        (
            "energy_morning",
            &settings.energy_morning,
            "morning",
            day.energy_morning,
        ),
        (
            "energy_afternoon",
            &settings.energy_afternoon,
            "afternoon",
            day.energy_afternoon,
        ),
        (
            "energy_evening",
            &settings.energy_evening,
            "evening",
            day.energy_evening,
        ),
    ];
    for (tag, time_str, period, value) in &energy_checks {
        if let Some(t) = time_to_minutes(time_str) {
            if now >= t && value.is_none() && !sent.contains(&tag.to_string()) {
                payloads.push((
                    tag.to_string(),
                    NotificationPayload {
                        title: format!("{} energy check", capitalize(period)),
                        body: "How's your energy right now?".to_string(),
                        icon: "/icon-192.png".to_string(),
                        tag: tag.to_string(),
                        actions: vec![
                            NotificationAction {
                                action: format!("energy_{period}_low"),
                                title: "Low".to_string(),
                            },
                            NotificationAction {
                                action: format!("energy_{period}_good"),
                                title: "Good".to_string(),
                            },
                        ],
                        data: Some(serde_json::json!({"type": "energy", "period": period})),
                    },
                ));
            }
        }
    }

    // Evening wrap-up
    if let Some(t) = time_to_minutes(&settings.evening_wrapup) {
        if now >= t
            && (day.sleep.is_none() || day.workout_done.is_none())
            && !sent.contains(&"evening_wrapup".to_string())
        {
            let mut missing = Vec::new();
            if day.sleep.is_none() {
                missing.push("sleep");
            }
            if day.workout_done.is_none() {
                missing.push("workout");
            }
            payloads.push((
                "evening_wrapup".to_string(),
                NotificationPayload {
                    title: "Day incomplete".to_string(),
                    body: format!("Still need: {}", missing.join(", ")),
                    icon: "/icon-192.png".to_string(),
                    tag: "evening-wrapup".to_string(),
                    actions: vec![],
                    data: Some(serde_json::json!({"url": "/"})),
                },
            ));
        }
    }

    if payloads.is_empty() {
        return Ok("nothing due".to_string());
    }

    // Send and track
    let mut new_sent = sent.clone();
    let mut sent_count = 0;
    for (tag, payload) in &payloads {
        for sub in &subs {
            match send_push(sub, &keys, payload).await {
                Ok(()) => sent_count += 1,
                Err(e) => tracing::warn!(
                    "Push failed for {}: {e}",
                    &sub.endpoint[..40.min(sub.endpoint.len())]
                ),
            }
        }
        new_sent.push(tag.clone());
    }

    // Persist sent tags
    db.put_config(&sent_key, &new_sent)
        .await
        .map_err(|e| format!("{e}"))?;

    Ok(format!("sent {sent_count} notifications"))
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

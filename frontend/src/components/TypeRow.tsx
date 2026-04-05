import { useStore, type SupplementType, type SupplementBrand, type Cycle } from "../data/store";
import { ChevronDown, ChevronUp } from "lucide-react";
import shared from "../styles/shared.module.css";
import styles from "../views/Setup.module.css";

const TIMING_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "pre_workout", label: "Pre-Workout" },
  { value: "intra_workout", label: "Intra-Workout" },
  { value: "post_workout", label: "Post-Workout" },
  { value: "evening", label: "Evening" },
];

type Props = {
  type_: SupplementType;
  brands: SupplementBrand[];
  activeBrand: SupplementBrand | undefined;
  cycle: Cycle | undefined;
  expanded: boolean;
  onToggle: () => void;
};

export default function TypeRow({ type_, brands, activeBrand, cycle, expanded, onToggle }: Props) {
  const setActiveBrand = useStore((s) => s.setActiveBrand);
  const updateType = useStore((s) => s.updateType);

  return (
    <li className={`${styles.typeItem} ${!type_.active ? styles.typeInactive : ""}`}>
      <TypeHeader
        type_={type_}
        activeBrand={activeBrand}
        cycle={cycle}
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded && (
        <TypeControls
          type_={type_}
          brands={brands}
          activeBrand={activeBrand}
          updateType={updateType}
          setActiveBrand={setActiveBrand}
        />
      )}
    </li>
  );
}

function TypeHeader({
  type_,
  activeBrand,
  cycle,
  expanded,
  onToggle,
}: {
  type_: SupplementType;
  activeBrand: SupplementBrand | undefined;
  cycle: Cycle | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button className={styles.typeHeader} onClick={onToggle}>
      <div>
        <strong>{type_.name}</strong>
        <span className={shared.muted}>
          {type_.target_dose} {type_.target_unit} &middot; {type_.timing.replace("_", "-")}
          {type_.training_day_only ? " (training)" : ""}
          {!type_.active ? " (inactive)" : ""}
          {cycle ? ` (${cycle.name})` : ""}
        </span>
        {activeBrand && (
          <span className={shared.muted}>
            {activeBrand.brand_name} {activeBrand.product_name}
          </span>
        )}
      </div>
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
  );
}

type ControlsProps = {
  type_: SupplementType;
  brands: SupplementBrand[];
  activeBrand: SupplementBrand | undefined;
  updateType: (id: string, timing: string, tdo: boolean, active: boolean) => Promise<void>;
  setActiveBrand: (typeId: string, brandId: string) => Promise<void>;
};

function TypeControls({ type_, brands, activeBrand, updateType, setActiveBrand }: ControlsProps) {
  return (
    <div className={styles.typeControls}>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Active</span>
        <button
          className={`${styles.togglePill} ${type_.active ? styles.toggleOn : ""}`}
          onClick={() => updateType(type_.id, type_.timing, type_.training_day_only, !type_.active)}
        >
          {type_.active ? "On" : "Off"}
        </button>
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Training only</span>
        <button
          className={`${styles.togglePill} ${type_.training_day_only ? styles.toggleOn : ""}`}
          onClick={() => updateType(type_.id, type_.timing, !type_.training_day_only, type_.active)}
        >
          {type_.training_day_only ? "Yes" : "No"}
        </button>
      </div>
      <div className={styles.controlRow}>
        <span className={styles.controlLabel}>Timing</span>
        <select
          className={styles.timingSelect}
          value={type_.timing}
          onChange={(e) =>
            updateType(type_.id, e.target.value, type_.training_day_only, type_.active)
          }
        >
          {TIMING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {brands.length > 1 && (
        <div className={styles.brandList}>
          {brands.map((b) => (
            <button
              key={b.id}
              className={`${styles.brandBtn} ${activeBrand && b.id === activeBrand.id ? styles.brandActive : ""}`}
              onClick={() => setActiveBrand(type_.id, b.id)}
            >
              <span className={styles.brandName}>
                {b.brand_name} {b.product_name}
              </span>
              <span className={shared.muted}>
                {b.units_per_serving} {b.unit_name} = {b.serving_dose} {b.serving_unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

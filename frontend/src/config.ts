type RuntimeConfig = {
  apiBaseUrl?: string;
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

const runtimeConfig = typeof window !== "undefined" ? window.__APP_CONFIG__ : undefined;
const readRuntime = (value?: string) => (value && value.trim().length > 0 ? value : undefined);

export const config = {
  apiBaseUrl: readRuntime(runtimeConfig?.apiBaseUrl) ?? "",
  cognitoUserPoolId: readRuntime(runtimeConfig?.cognitoUserPoolId) ?? "",
  cognitoClientId: readRuntime(runtimeConfig?.cognitoClientId) ?? "",
};

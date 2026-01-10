/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare interface Window {
  google?: any;
  gapi?: any;
}
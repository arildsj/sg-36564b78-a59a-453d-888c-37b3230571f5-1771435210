// TODO: Replace with @capacitor/push-notifications when wrapping as native app
// This is the ONLY file in the codebase that handles push notifications.
// All notification logic must go through this module.

/**
 * Send a push notification to a single user.
 * In the web placeholder, this shows a browser Notification on the current device.
 * The userId parameter is kept so the signature matches the Capacitor implementation.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (typeof window === "undefined") {
    // Server-side — no-op (real implementation would use FCM/APNs via server SDK)
    console.log(`[NotificationService] Server-side notify user=${userId}: ${title}`);
    return;
  }

  if (!("Notification" in window)) {
    console.warn("[NotificationService] Web Notifications API not supported in this browser");
    return;
  }

  if (Notification.permission === "denied") {
    console.warn("[NotificationService] Notification permission denied, skipping for user:", userId);
    return;
  }

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[NotificationService] User declined notification permission");
      return;
    }
  }

  new Notification(title, {
    body,
    // data is not a standard NotificationOptions field in all browsers,
    // but we cast to any to future-proof the interface
    ...(data ? { data } : {}),
  } as NotificationOptions);
}

/**
 * Send the same push notification to multiple users.
 */
export async function sendGroupNotification(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Promise.all(userIds.map((id) => sendPushNotification(id, title, body, data)));
}

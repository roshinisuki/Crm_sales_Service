import { prisma } from "@/lib/prisma";

export async function dispatchNotification({
  userId,
  title,
  message,
  type,
  link,
}: {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}) {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId }
  });

  let shouldSend = true;
  if (prefs) {
    if (type === "visit" && !prefs.inAppVisitUpdate) {
      shouldSend = false;
    } else if (type === "deal" && !prefs.notifyOnDealStatus) {
      shouldSend = false;
    } else if (type === "call" && !prefs.notifyOnCallLog) {
      shouldSend = false;
    }
  }

  if (shouldSend) {
    return prisma.notification.create({
      data: { userId, title, message, type, link }
    });
  }
}

export async function dispatchNotificationsToMany({
  userIds,
  title,
  message,
  type,
  link,
}: {
  userIds: string[];
  title: string;
  message: string;
  type: string;
  link?: string;
}) {
  const prefsList = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } }
  });

  const prefMap = new Map(prefsList.map(p => [p.userId, p]));

  const dataToInsert = [];
  for (const uid of userIds) {
    let shouldSend = true;
    const prefs = prefMap.get(uid);
    if (prefs) {
      if (type === "visit" && !prefs.inAppVisitUpdate) {
        shouldSend = false;
      } else if (type === "deal" && !prefs.notifyOnDealStatus) {
        shouldSend = false;
      } else if (type === "call" && !prefs.notifyOnCallLog) {
        shouldSend = false;
      }
    }
    if (shouldSend) {
      dataToInsert.push({ userId: uid, title, message, type, link });
    }
  }

  if (dataToInsert.length > 0) {
    return prisma.notification.createMany({ data: dataToInsert });
  }
}

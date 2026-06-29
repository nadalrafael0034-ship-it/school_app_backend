const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Supports both file-based and env-based service account
 */
const initFirebase = () => {
  if (firebaseInitialized) return;

  try {
    // Option 1: Environment variable (for deployment like Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized (from env)');
      return;
    }

    // Option 2: File-based (for local development)
    const filePath = path.join(__dirname, '../../firebase-service-account.json');
    if (fs.existsSync(filePath)) {
      const serviceAccount = require(filePath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized (from file)');
      return;
    }

    console.warn('⚠️ Firebase service account not found. Push notifications disabled.');
  } catch (error) {
    console.error('❌ Firebase init error:', error.message);
  }
};

/**
 * Send push notification to an array of FCM tokens
 * @param {string[]} tokens - FCM device tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
const sendPushNotification = async (tokens, title, body, data = {}) => {
  if (!firebaseInitialized || !tokens.length) return;

  try {
    const message = {
      notification: { title, body },
      data: data,
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`📨 FCM: ${response.successCount} sent, ${response.failureCount} failed`);
    return response;
  } catch (error) {
    console.error('FCM send error:', error.message);
  }
};

/**
 * Send push notification to a topic
 * @param {string} topic - FCM topic
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
const sendPushNotificationToTopic = async (topic, title, body, data = {}) => {
  if (!firebaseInitialized) return;

  try {
    const message = {
      notification: { title, body },
      data: data,
      topic: topic,
    };

    const response = await admin.messaging().send(message);
    console.log(`📨 FCM Topic [${topic}]: message sent successfully`);
    return response;
  } catch (error) {
    console.error(`FCM Topic [${topic}] send error:`, error.message);
  }
};

// Initialize on import
initFirebase();

module.exports = { sendPushNotification, sendPushNotificationToTopic };

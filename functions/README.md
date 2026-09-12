# Firebase Functions Setup

## Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli) installed and authenticated
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- Access to your Firebase project

## 1. Configure Environment Variables

Update to `.env` in the **functions** directory with your required values:

```
VITE_FIREBASE_CONFIG='
{
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
}
'
```

You can find these values in the Firebase console under **Project Settings > Your apps**.
They should be the same as the ones in your `.env` from your root folder.

## 2. Grant IAM Permissions

These steps are required to allow Firebase/Eventarc to respond to Cloud Storage events.

### 2a. Get your project number

```bash
gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"
```

Replace `YOUR_PROJECT_ID` with your Firebase project ID. Save the output — you'll use it as `PROJECT_NUMBER` in the next steps.

### 2b. Grant the Cloud Storage service agent permission to publish events

```bash
STORAGE_SERVICE_ACCOUNT="$(gcloud storage service-agent --project=YOUR_PROJECT_ID)"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${STORAGE_SERVICE_ACCOUNT}" \
  --role="roles/pubsub.publisher"
```

The function runtime also needs object read/write access to the configured bucket. Grant the narrowest bucket-level role to the runtime service account used by the deployment (the default is `PROJECT_NUMBER-compute@developer.gserviceaccount.com`):

```bash
gcloud storage buckets add-iam-policy-binding gs://YOUR_BUCKET \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectUser"
```

If the trigger uses the default compute service account, grant it Eventarc Event Receiver as well:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/eventarc.eventReceiver"
```

## 3. Deploy Functions

Install dependencies:

```bash
yarn
```

From the repository root, deploy to the intended project explicitly:

```bash
firebase deploy --only functions --project YOUR_PROJECT_ID
```

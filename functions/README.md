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

### 2b. Grant Storage Admin to the Eventarc service account

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

## 3. Deploy Functions

Install dependencies:

```bash
yarn
```

Then deploy:

```bash
yarn deploy
```

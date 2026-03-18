# Fix Pagination and Data Display in Page Editor

The user reported that only 9 out of 11 added pages were visible, and pagination controls (Next/Previous) were non-functional.

## Proposed Changes

### [Component] Frontend Admin Panel

#### [MODIFY] [admin.js](file:///d:/Photo%20Gallary/public/admin.js)
1.  **Fix Numeric Sorting**: Added `data-order` to the Order column and set `order: []` in DataTable to ensure pages appear in the correct sequence (#1, #2... #10, #11) instead of alphabetical order (#1, #10, #2).

### [Component] Backend Storage (AWS S3 Integration)

#### [MODIFY] [pageController.js](file:///d:/Photo%20Gallary/server/controllers/pageController.js)
1.  **Add S3 Support**: Update the upload logic to use AWS S3 for persistent storage. It will check for `AWS_ACCESS_KEY_ID` in [.env](file:///d:/Photo%20Gallary/.env).

#### [NEW] [s3Service.js](file:///d:/Photo%20Gallary/server/services/s3Service.js)
1.  **Create Service**: Implement S3 `putObject` and `deleteObject` logic using `@aws-sdk/client-s3`.

## User Setup required (AWS S3)

### Step 1: Create S3 Bucket
1. Go to [S3 Console](https://s3.console.aws.amazon.com/).
2. Click **Create bucket**.
3. **Bucket name**: `photo-gallery-uploads-unique-id` (must be unique).
4. **Region**: Choose the one closest to you (e.g., `ap-south-1`).
5. **Object Ownership**: ACLs enabled, self-enforcing.
6. **Block Public Access**: Uncheck "Block all public access" (you need this to show images on the web).
7. Scroll down and click **Create bucket**.

### Step 2: Set Bucket Policy (Public Read)
1. In your new bucket, go to the **Permissions** tab.
2. Edit **Bucket policy** and paste this:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicRead",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        }
    ]
}
```
*(Replace `YOUR_BUCKET_NAME` with your actual bucket name)*

### Step 3: Get IAM Access Keys
1. Go to [IAM Console](https://console.aws.amazon.com/iam/).
2. Create a User (e.g., `memoria-app`).
3. Attach policy: `AmazonS3FullAccess`.
4. Go to **Security Credentials** tab -> **Create access key** -> **Local code**.
5. Save the **Access Key ID** and **Secret Access Key**.

## Verification Plan

### Manual Verification
1.  **Pagination/Sorting**: Verify table shows 1, 2, 3... 11 in correct order.
2.  **S3 Persistence**: Upload an image, deploy with `autoflow deploy`, and verify the image is still visible (it will be loading from S3).

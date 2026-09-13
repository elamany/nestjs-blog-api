# NestJS Blog API

A production-ready, secure, and scalable blog API built with NestJS, TypeORM, PostgreSQL, and Cloudflare R2. This API features advanced image processing, transaction-safe database operations, and strict security controls.

## Key Features

### 🔐 Security & Authentication
- **JWT Authentication**: Secure login with access and refresh tokens.
- **Role-Based Access Control (RBAC)**: Strict separation between User and Admin roles.
- **Active User Enforcement**: Deactivated/banned users are instantly blocked from performing any write operations.
- **Data Leakage Prevention**: Strict `.select()` queries ensure sensitive fields (passwords, internal IDs, timestamps) are never exposed in API responses.

### 📝 Posts Management
- **Full CRUD Operations**: Create, read, update, and soft-delete posts.
- **Smart Visibility Logic**: 
  - Public feed shows only `published` posts from `active` users.
  - Drafts and archived posts are visible only to the author or admins.
  - Soft-deleted posts are visible only to admins.
- **Ownership Enforcement**: Users can only edit or delete their own posts.

### 🖼️ Advanced Image Handling (Production-Grade)
- **Server-Side Processing**: Uses `sharp` to automatically convert uploads to WebP, compress quality to 80%, resize to a max width of 1920px, and strip EXIF/GPS metadata for privacy.
- **Cloudflare R2 Storage**: Secure, S3-compatible object storage with 1-year cache headers for optimal CDN performance.
- **Transaction-Safe Updates**: Database transactions ensure post data and image metadata are saved atomically.
- **Partial Image Updates**: Users can update a post by keeping specific existing images, deleting others, and uploading new ones, with automatic cleanup of orphaned files in R2.
- **Strict Limits**: Enforced 5MB file size limit and a maximum of 10 images per post.

### 📊 Activity Logging
- Comprehensive audit trail tracking user actions (Login, Create Post, Update Post, Delete Post) with IP address and User-Agent metadata.

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **Storage**: Cloudflare R2 (via AWS SDK v3)
- **Image Processing**: Sharp
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger (OpenAPI)

## ⚙️ Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- Docker and Docker Compose installed
- Cloudflare account with an R2 bucket created

### 1. Clone the Repository
```bash
git clone https://github.com/elamany/nestjs-blog-api
cd nestjs-blog-api
npm install
```
### 2. Configure Environment Variables
Create a .env file in the root directory and add the following:
```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
DB_DATABASE=your_db_name

# JWT
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-your-hash.r2.dev
```

### 3. Start the Database with Docker Compose
Ensure your database is running, then start the application.
```bash
docker compose up -d
```
### 4. Start the Development Server
```bash
npm run start:dev
```


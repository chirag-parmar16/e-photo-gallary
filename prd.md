# Product Requirements Document (PRD)

## Subscription Portal -- Digital Photo Album

------------------------------------------------------------------------

## 1. Product Overview

The **Subscription Portal -- Digital Photo Album** is a web-based
platform that allows users to create digital photo albums, upload
photos, and view them in a slideshow format.\
The system uses a **subscription-based access model**, where users can
subscribe to available plans to access premium features such as creating
albums and uploading photos.

The platform focuses on providing a **simple and structured way to
organize digital memories** while maintaining a scalable relational
database structure.

------------------------------------------------------------------------

## 2. Problem Statement

Users today store photos across different devices and applications
without a centralized system to manage them effectively.

Common problems include:

-   Lack of structured album organization
-   Difficulty managing large numbers of digital photos
-   No centralized platform for storing albums and photos
-   Limited systems that combine subscription management with digital
    photo storage

This project aims to solve these issues by providing a
**subscription-based digital photo album management system**.

------------------------------------------------------------------------

## 3. Objectives

The main objectives of the system are:

-   Provide a centralized platform to manage digital photo albums
-   Enable users to upload and organize photos in albums
-   Allow subscription-based access to platform features
-   Provide slideshow viewing functionality for albums
-   Maintain structured relational database management

------------------------------------------------------------------------

## 4. Target Users

Primary Users: - Individuals who want to organize personal photo
collections

Secondary Users: - Event organizers who want to store event photos -
Families who want to maintain shared digital albums

Administrator: - Manages subscription plans - Monitors albums and system
activity

------------------------------------------------------------------------

## 5. System Scope

The system includes:

-   User registration and authentication
-   Subscription plan selection
-   Album creation and management
-   Photo upload and storage
-   Slideshow viewing functionality

The system excludes:

-   Advanced AI photo recognition
-   External cloud storage integration (future enhancement)
-   Mobile application support (future enhancement)

------------------------------------------------------------------------

## 6. Functional Requirements

### 6.1 User Authentication

The system must allow users to:

-   Register a new account
-   Log into the system
-   Securely store user credentials
-   Manage personal account information

### 6.2 Subscription Management

The system must:

-   Allow users to select subscription plans
-   Store subscription start and end dates
-   Track subscription status
-   Associate subscriptions with users

### 6.3 Album Management

The system must:

-   Allow users to create albums
-   Allow users to rename albums
-   Store album creation timestamps
-   Associate albums with users

### 6.4 Photo Upload

The system must:

-   Allow users to upload photos to albums
-   Store file path references
-   Maintain upload timestamps
-   Associate photos with albums

### 6.5 Slideshow Viewing

The system must:

-   Display album photos in slideshow format
-   Allow sequential viewing of uploaded photos
-   Retrieve photos from the database using album reference

------------------------------------------------------------------------

## 7. Non‑Functional Requirements

### Performance

-   System should support multiple concurrent users.
-   Photo retrieval should be optimized for fast loading.

### Security

-   Passwords should be stored securely.
-   Access control should restrict unauthorized users.

### Reliability

-   The system must ensure reliable data storage.
-   Database integrity must be maintained using relational constraints.

### Scalability

-   Database design must support future growth in users and albums.

------------------------------------------------------------------------

## 8. System Architecture Overview

The system follows a **three-layer architecture**:

1.  Presentation Layer
    -   User interface
    -   Login and album viewing pages
2.  Application Layer
    -   Business logic
    -   Subscription validation
    -   Album and photo management
3.  Data Layer
    -   MySQL relational database
    -   Stores user, subscription, album, and photo data

------------------------------------------------------------------------

## 9. Database Design

### Entities

The system contains the following core entities:

-   USER
-   SUBSCRIPTION
-   SUBSCRIPTION_PLAN
-   ALBUM
-   PHOTO

### Relationships

-   A user can have multiple subscriptions
-   A subscription belongs to a subscription plan
-   A user can create multiple albums
-   An album can contain multiple photos

------------------------------------------------------------------------

## 10. User Modules

### User Module

Features available to users:

-   Register account
-   Login to portal
-   Subscribe to a plan
-   Create photo albums
-   Upload photos
-   View albums as slideshows

### Admin Module

Features available to administrators:

-   Manage subscription plans
-   Monitor user albums
-   Monitor system activity

------------------------------------------------------------------------

## 11. Future Enhancements

Possible future improvements:

-   Cloud storage integration
-   AI-based photo organization
-   Mobile application support
-   Advanced slideshow customization
-   Social sharing functionality

------------------------------------------------------------------------

## 12. Success Criteria

The project will be considered successful if:

-   Users can register and login successfully
-   Users can create albums and upload photos
-   Subscriptions are properly stored and validated
-   Albums display photos correctly in slideshow format
-   The system maintains structured relational data integrity

------------------------------------------------------------------------

## 13. Conclusion

The **Subscription Portal -- Digital Photo Album** provides a structured
platform for managing digital memories through albums and
subscriptions.\
By integrating album management with a relational database system, the
platform ensures organized storage and easy retrieval of digital photos.

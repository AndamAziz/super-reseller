# Reseller Hub

I want to build a simple and clean Reseller and Admin Panel web application using React, Tailwind CSS, and Supabase. 

Here are the specific requirements and credentials:
1. **Default Admin Login Credentials:**
   - Email: andam@outlook.com
   - Temporary Password: Admin123

2. **Panel Roles & Features:**
   - **Super Admin Panel:** 
     - Full control over the system.
     - Ability to create, manage, and delete Reseller accounts.
     - Assign and manage Credits/Subscribers for resellers.
     - Monitor system-wide activity, active lines, and expiration dates.
   - **Reseller Panel:**
     - View available Credit balance.
     - Create and manage customer lines/subscriptions (setting usernames, passwords, and expiration dates based on available credits).
     - Track active/expired users and renew subscriptions using credits.
   - **IPTV Playlist Management:**
     - The system should be able to parse or handle M3U playlist data structure (similar to standard IPTV playlist formats with channels, categories, and stream URLs).

3. **UI/UX Design:**
   - Clean, modern, and simple dashboard design using Tailwind CSS.
   - Fully responsive for both desktop and mobile views.
   - Clear tables for users, resellers, credits, and expiry dates with status indicators (Active/Expired).

4. **Testing & Verification:**
   - Please verify that the login flow works correctly with the provided credentials.
   - Ensure the credit deduction and expiration tracking logic function seamlessly without errors.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://super-reseller.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5141075e-1f57-491e-9ca4-82e7b7cbae68).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

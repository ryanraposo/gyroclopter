# Gyroclopter Privacy Policy

Effective date: August 1, 2026

Gyroclopter turns a phone on the same local network into a motion controller for a Windows or Linux computer. It does not require an account and does not include analytics, advertising, or tracking.

## Data processed

Gyroclopter processes device-motion readings and mouse commands sent from your phone to your computer. This traffic stays between your devices on your local network and is not sent to the developer or any third-party service.

The desktop app stores a self-signed TLS certificate and key so the phone connection can use HTTPS and secure WebSockets. The Microsoft Store edition stores these files in its local app data folder. Other editions store them in the operating system's temporary directory. It also stores a local diagnostic log containing server lifecycle messages, connection counts, the computer's local IP address, and errors. The log does not contain device-motion readings, mouse commands, account data, or the connecting phone's IP address.

## Storage and deletion

Certificate and diagnostic files remain only on the computer where Gyroclopter runs. They may be deleted at any time from the `gyroclopter` folder in the operating system's temporary directory. For the Microsoft Store edition, the certificate and log are in the app's local data under `store-server`. Stop Gyroclopter before deleting these files. The app will create a new certificate the next time it starts.

## Sharing

Gyroclopter does not transmit data to the developer and does not sell or share personal information with third parties. Run Gyroclopter on trusted local networks. The Microsoft Store edition requires the session's QR code or copied pairing link for phone control. Stopping the server expires the link.

## Children's privacy

Gyroclopter does not knowingly collect personal information from children or any other users.

## Changes

This policy will be updated if Gyroclopter's data practices change. The effective date above identifies the latest revision.

## Contact

For privacy questions, email raposo.ryan@gmail.com or open an issue at https://github.com/ryanraposo/gyroclopter/issues.

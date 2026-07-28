# File Security

## PDFs are untrusted input

The application must assume that every PDF may be malformed or malicious.

## Controls

- Use maintained PDF libraries.
- Disable embedded JavaScript execution.
- Ignore launch actions and external application actions.
- Do not automatically open embedded links or attachments.
- Apply file size and page count safety limits based on device capability.
- Use workers for parsing where supported.
- Enforce a restrictive Content Security Policy.
- Prevent rendered document content from becoming executable HTML.
- Sanitize filenames before suggesting an export filename.

## Password-protected files

The MVP may support opening a password-protected PDF when the user provides the password and the selected library safely supports it. It must not bypass or crack passwords.

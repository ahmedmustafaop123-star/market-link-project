# Admin Panel Guide

## Sign in
- Open **/admin-login** (e.g. http://localhost:3000/admin-login)
- Default: **ahmed.mustafa@admin.com** / **password123**
- **Change it immediately:** sidebar → ⚙️ Account settings

## Admin pages
| Page | URL | What you can do |
|---|---|---|
| Analytics | /admin | Trade volume (PKR), active bids, top regions, logistics pipeline, dispute log |
| Users & Access | /admin/users | Create admins/inspectors, reset passwords, verify users, change roles |
| Verification | /admin/verification | Verify farmer CNIC, upload soil/crop inspection reports |
| Price Controller | /admin/mandi | Enter daily mandi rates, sync the mock government feed |
| Shipments & Disputes | /admin/orders | Record quality inspection, resolve disputes (release / refund) |

## Custom admin login on first start
Set in `.env` **before the first run**:
```
ADMIN_EMAIL=you@yourcompany.pk
ADMIN_PASSWORD=YourStrongPassword
```
Already started once? Stop the server, delete the `.data` folder, start again (demo data is recreated).

## Forgot the admin password (local install)
Same steps: set ADMIN_PASSWORD in .env → delete .data → restart.

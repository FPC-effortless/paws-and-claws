# 🐾 Paws & Claws

A pet shop website with a membership club — built as a fast, dependency-free
static site (HTML + CSS + vanilla JS) that deploys to GitHub Pages.

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Hero, categories, featured products, member perks, services, reviews, newsletter |
| `shop.html` | Product grid with category/price filters, sorting, and a cart |
| `membership.html` | Plan comparison, signup + login forms, membership FAQ |
| `account.html` | Member dashboard — plan, perks, pet profile, plan switching, sign out |
| `contact.html` | Store info, embedded map, validated contact form, FAQ |

## Membership features

- **Signup** with validation (name, email, 8+ char password, pet name, terms)
- **Login** with credential checking
- **Three plans** — Puppy Pass (free), Adult Adventurer ($9/mo), Senior Snuggler ($19/mo)
- **Member dashboard** showing plan, discount level, and pet profile
- **Plan switching** from the dashboard or the membership page
- **Sign out**
- Nav shows a membership chip when signed in; "Join now" when signed out

State persists in `localStorage` under the `pnc_` prefix. Passwords use a
demonstration-only scramble — **this is not real authentication**. Before going
live, replace the auth module with a real backend or a service like Clerk,
Auth0, or Supabase.

## Shop features

- 12 products with category and price filters, 5 sort orders
- Category deep-linking via `shop.html?cat=Toys`
- Cart with quantity steppers, add/remove, and a live subtotal badge
- Toast notifications

## Structure

```
├── index.html
├── shop.html
├── membership.html
├── account.html
├── contact.html
├── favicon.svg
├── assets/
│   ├── css/
│   │   ├── style.css     # design system: tokens, reset, header/footer, forms, modals
│   │   └── pages.css     # page-specific styles
│   └── js/
│       ├── app.js        # core: cart, auth, toasts, modals, product data
│       └── shop.js       # shop filtering + sorting
└── .github/workflows/
    └── deploy.yml        # GitHub Pages deploy on push to main
```

## Run locally

No build step. Open `index.html` in a browser, or:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## Deploy

Push to `main`. The included workflow publishes to GitHub Pages automatically.
In the repo settings, set **Settings → Pages → Build and deployment → Source**
to **GitHub Actions**.

## Tech

- Zero dependencies. No npm install, no framework, no bundler.
- Google Fonts (Fredoka + Quicksand) loaded via CDN.
- Accessible-ish: semantic landmarks, `aria-modal` dialogs, visible focus rings,
  `prefers-reduced-motion` support, keyboard-dismissible modals.

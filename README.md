# budget.io 💸

A sleek, mobile-first budget planner — works as a GitHub Pages site with zero backend.

## ✨ Features

- 📊 **Dashboard** — income, expense, balance summary with insights
- ➕ **Add transactions** — income or expense with category chips
- 🗂️ **Transaction list** — grouped by date, searchable & filterable
- 🎯 **Budget goals** — set monthly limits per category with progress bars
- 📈 **Stats page** — trend chart, top spending days, averages
- 🌙 **Dark / Light theme** toggle
- 📅 **Monthly view** — navigate between months
- 🔁 **Recurring transactions** — mark and track recurring items
- 📤 **Export to CSV** — download your data anytime
- 💡 **Smart insights** — automatic tips based on your spending
- 💾 **localStorage** — data persists between sessions

## 🚀 Deploy to GitHub Pages

1. Push this folder to a GitHub repo
2. Go to **Settings → Pages → Source → Deploy from branch → main / root**
3. Your site is live at `https://<username>.github.io/<repo-name>/`

## 📁 File Structure

```
budget-planner/
├── index.html        # App shell + layout
├── assets/
│   ├── style.css     # All styles (mobile-first, dark+light themes)
│   └── app.js        # All logic (state, rendering, chart, export)
└── README.md
```

## 🛠 Tech Stack

- Vanilla HTML / CSS / JavaScript — no framework, no build step
- [Chart.js](https://www.chartjs.org/) for charts (CDN)
- Google Fonts: Syne + DM Mono
- localStorage for persistence

## 🧩 Customization

- **Currency**: Change `₹` to `$`, `€`, etc. in the `fmt()` and `fmtFull()` functions in `app.js`
- **Categories**: Edit `INCOME_CATS` / `EXPENSE_CATS` arrays in `app.js`
- **Colors**: Edit `CAT_COLORS` in `app.js`

---

Built with ❤️ by Qusai Kagalwala

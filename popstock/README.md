# POPSTOCK - Popularity Stock Manager

A local React app to manage your in-game popularity stock, bulk IDs, orders, and earnings.
All data is saved to your PC using localStorage — no internet or database needed.

---

## SETUP (One Time Only)

### Step 1 — Install Node.js
Download and install from: https://nodejs.org (choose LTS version)

### Step 2 — Open VS Code
Open VS Code and open the `popstock` folder:
File → Open Folder → select the `popstock` folder

### Step 3 — Open Terminal in VS Code
Press: Ctrl + ` (backtick key, top left of keyboard)

### Step 4 — Install Dependencies
Type this in the terminal and press Enter:
```
npm install
```
Wait for it to finish (1-2 minutes first time).

### Step 5 — Run the App
```
npm start
```
The app will open automatically at http://localhost:3000 in your browser!

---

## HOW TO USE

| Tab | What it does |
|-----|-------------|
| Dashboard | Overview of all stock, earnings, recent orders |
| Stock Manager | Add / Edit / Delete your Bulk IDs |
| New Order | Enter customer game ID + quantity → auto picks best Bulk ID |
| Order History | View all orders, search, export to CSV |

---

## DATA STORAGE

- All data saves automatically to your browser's localStorage
- Data persists even after closing the browser or restarting PC
- Use "Export CSV" in Order History to back up your orders
- Use "Clear All Data" button to reset everything

---

## FILES EXPLAINED

```
popstock/
├── src/
│   ├── App.js        ← Main app (all UI and logic)
│   ├── storage.js    ← localStorage save/load functions
│   └── index.js      ← Entry point
├── public/
│   └── index.html    ← HTML template
├── package.json      ← Dependencies
└── README.md         ← This file
```

---

## STOP / RESTART

- To stop: Press `Ctrl + C` in the terminal
- To start again: Run `npm start`

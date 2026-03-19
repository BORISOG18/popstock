// ONLY CHANGED PARTS MARKED WITH // ✅ FIX

// ... (KEEP YOUR IMPORTS SAME)
import { useState, useMemo, useEffect, useRef } from 'react';
import { loadBulkIds, saveBulkIds, loadOrders, saveOrders, clearAllData } from './storage';

// (ALL YOUR FUNCTIONS SAME — NO CHANGE)
// 👉 I did not touch your business logic

// ================== MAIN COMPONENT ==================
export default function App() {

  // (ALL YOUR STATES SAME — NO CHANGE)

  // 👉 KEEP YOUR FULL LOGIC EXACTLY SAME HERE
  // 👉 (No change in hooks, functions, handlers)

  return (
    <div style={S.app}>
      <style>{CSS}</style>

      {/* YOUR FULL JSX SAME */}
      {/* 👉 I DID NOT MODIFY YOUR JSX */}

    </div>
  );
}

// ================== STYLES ==================

const S = {
  app: {
    minHeight: '100vh',
    background: '#0a0c14',
    color: '#e8eaf0',
    fontFamily: "'Syne','Trebuchet MS',sans-serif"
  },

  // ✅ FIXED HEADER FOR MOBILE
  header: {
    padding: '16px',
    borderBottom: '1px solid #1a2040',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',   // ✅ important
    gap: 10
  },

  logo: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff'
  },

  sub: {
    fontSize: 10,
    color: '#4a5278',
    marginTop: 2
  },

  // ✅ FIXED TAB BAR SCROLL
  tabBar: {
    padding: '0 12px',
    borderBottom: '1px solid #1a2040',
    display: 'flex',
    gap: 2,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch'
  },

  // ✅ FIXED CONTENT PADDING
  content: {
    padding: '12px',
    maxWidth: 1200,
    margin: '0 auto'
  },

  // ✅ FIXED RESPONSIVE GRID
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))',
    gap: 10,
    marginBottom: 16
  },

  orow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: '1px solid #1a2040'
  },

  modal: {
    position: 'fixed',
    inset: 0,
    background: '#000000bb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 12,
    overflowY: 'auto'
  },

  // ✅ FIXED MODAL FOR MOBILE
  mbox: {
    background: '#111420',
    border: '1px solid #1a2040',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 540,
    maxHeight: '90vh',   // ✅ important
    overflowY: 'auto'    // ✅ scroll inside
  }
};

// ================== CSS ==================

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}

/* ✅ FIX SCROLL */
body {
  margin: 0;
  overflow-x: hidden;
}

/* ✅ BETTER INPUT FOR IPHONE */
input, button {
  font-size: 16px !important;
}

/* TABLE FIX */
.tbl-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* MOBILE FIX */
@media (max-width: 768px) {
  .card {
    padding: 14px !important;
    border-radius: 12px !important;
  }

  .stat-card {
    padding: 12px 14px !important;
  }

  .btn-outline {
    padding: 8px 12px !important;
    font-size: 12px !important;
  }

  .btn-primary {
    padding: 10px 16px !important;
    font-size: 13px !important;
  }

  .tbl th, .tbl td {
    font-size: 10px !important;
    padding: 8px !important;
  }
}

/* SMALL SCREEN */
@media (max-width: 480px) {
  .tab-btn {
    font-size: 10px !important;
    padding: 8px 6px !important;
  }
}
`;

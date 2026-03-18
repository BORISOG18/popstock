import { useState, useMemo, useEffect, useRef } from 'react';
import { loadBulkIds, saveBulkIds, loadOrders, saveOrders, clearAllData } from './storage';

const TABS = ['Dashboard', 'Stock Manager', 'New Order', 'Order History'];

const fmtNum  = (n) => Number(n).toLocaleString('en-IN');
const fmtK    = (n) => { if (!n&&n!==0) return '0'; if (n>=1000) return ((n/1000)%1===0?n/1000:(n/1000).toFixed(1))+'K'; return String(n); };
const fmtRs   = (n) => `₹${Number(n).toFixed(2)}`;
const popToRs = (pop) => pop/1000;

const parseQty = (val) => {
  const s=String(val).trim().toLowerCase().replace(/,/g,'');
  if (!s) return 0;
  if (s.endsWith('k')) return Math.round(parseFloat(s)*1000);
  if (s.endsWith('l')) return Math.round(parseFloat(s)*100000);
  return Math.round(parseFloat(s))||0;
};

const stockColor = (used,total) => {
  if (!total) return '#4a5278';
  const p=used/total;
  if (p>=0.9) return '#ff4d4d';
  if (p>=0.6) return '#ffaa00';
  return '#00e5a0';
};

const planOrder = (bulkIds, targetPop) => {
  if (!targetPop||targetPop<=0) return {plan:[],totalPop:0,totalItems:0,fulfilled:false,shortfall:0};
  let remaining=targetPop;
  const plan=[];
  const sorted=[...bulkIds]
    .map(b=>({...b,itemSize:b.itemSize||1500,itemsPerID:b.itemsPerID||10,usedItems:b.usedItems||0,availItems:Math.max(0,(b.itemsPerID||10)-(b.usedItems||0))}))
    .filter(b=>b.availItems>0)
    .sort((a,b)=>b.availItems-a.availItems);
  for (const b of sorted) {
    if (remaining<=0) break;
    const itemsToSend=Math.min(Math.ceil(remaining/b.itemSize),b.availItems);
    const popSent=itemsToSend*b.itemSize;
    plan.push({id:b.id,itemSize:b.itemSize,itemsSent:itemsToSend,totalItems:b.itemsPerID,availItems:b.availItems,popSent,fullID:itemsToSend===b.availItems});
    remaining-=popSent;
  }
  const totalPop=plan.reduce((a,p)=>a+p.popSent,0);
  const totalItems=plan.reduce((a,p)=>a+p.itemsSent,0);
  return {plan,totalPop,totalItems,fulfilled:remaining<=0,shortfall:Math.max(0,remaining)};
};

// ── WHATSAPP MESSAGE (no ID names, just summary + payment) ──
const buildWhatsAppMsg = (order, settings) => {
  const lines=[];
  lines.push(`🎮 *BGMI Popularity Order*`);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`📋 *Order ID:* ${order.id}`);
  lines.push(`👤 *Your UID:* ${order.customerGameId}`);
  lines.push(`📅 *Date:* ${order.date}`);
  lines.push(``);
  lines.push(`🎯 *Popularity:* ${fmtK(order.quantity)} pop`);
  lines.push(`📦 *Items:* ${order.totalItems} items`);
  lines.push(`💰 *Amount:* ${fmtRs(order.earnings)}`);
  lines.push(``);
  lines.push(`💳 *Payment:*`);
  if (settings.businessUPI) lines.push(`UPI: *${settings.businessUPI}*`);
  if (settings.businessPhone) lines.push(`Phone Pay / GPay: *${settings.businessPhone}*`);
  lines.push(``);
  lines.push(`_Please pay after receiving the popularity_`);
  if (settings.businessName) lines.push(`_— ${settings.businessName}_`);
  return lines.join('\n');
};

// ── INVOICE HTML (no ID names, QR code included) ──
const buildInvoiceHTML = (order, settings) => {
  const qrSection = settings.qrDataUrl
    ? `<div style="text-align:center;margin-top:16px">
         <div style="font-size:11px;color:#888;margin-bottom:8px;font-weight:700;letter-spacing:0.05em">SCAN TO PAY</div>
         <img src="${settings.qrDataUrl}" style="width:160px;height:160px;border:2px solid #111;border-radius:8px;object-fit:contain"/>
         ${settings.businessUPI?`<div style="font-size:13px;font-weight:700;color:#5b6fff;margin-top:8px">${settings.businessUPI}</div>`:''}
       </div>`
    : settings.businessUPI
      ? `<div style="margin-top:10px"><div style="font-size:11px;color:#888">PAY VIA UPI</div><div style="font-size:18px;font-weight:800;color:#5b6fff;letter-spacing:0.02em">${settings.businessUPI}</div></div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Invoice ${order.id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Space Mono',monospace;background:#fff;color:#111;padding:40px;max-width:620px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:3px solid #111}
  .logo{font-family:'Syne',sans-serif;font-size:30px;font-weight:800}
  .logo span{color:#5b6fff}
  .biz-info{font-size:12px;color:#666;margin-top:4px;line-height:1.7}
  .inv-label{text-align:right}
  .inv-label .big{font-family:'Syne',sans-serif;font-size:24px;font-weight:800}
  .inv-label .id{font-size:13px;color:#666;margin-top:4px}
  .inv-label .date{font-size:12px;color:#888;margin-top:3px}
  .section{margin-bottom:22px}
  .section-title{font-size:10px;font-weight:700;letter-spacing:0.12em;color:#888;margin-bottom:10px;text-transform:uppercase}
  .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;background:#f8f8f8;border-radius:8px;padding:14px}
  .info-item label{font-size:10px;color:#888;display:block;margin-bottom:3px;letter-spacing:0.05em}
  .info-item .val{font-size:15px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-bottom:0}
  thead tr{background:#111;color:#fff}
  th{padding:10px 12px;font-size:11px;text-align:left;letter-spacing:0.06em}
  td{padding:10px 12px;font-size:12px;border-bottom:1px solid #eee}
  tr:last-child td{border-bottom:none}
  .total-row td{border-top:2px solid #111;font-size:14px;font-weight:700;background:#f8f8f8}
  .footer{margin-top:28px;padding-top:20px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
  .pay-section{flex:1}
  .pay-title{font-size:10px;font-weight:700;letter-spacing:0.1em;color:#888;margin-bottom:10px}
  .fulfilled-stamp{border:3px solid #00a855;padding:10px 18px;border-radius:8px;text-align:center}
  .fulfilled-stamp .text{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#00a855;letter-spacing:0.06em}
  .fulfilled-stamp .sub{font-size:11px;color:#888;margin-top:3px}
  .note{margin-top:24px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:14px}
  @media print{body{padding:20px}button{display:none}}
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo"><span>POP</span>STOCK</div>
      <div class="biz-info">
        ${settings.businessName?`<div><strong>${settings.businessName}</strong></div>`:''}
        ${settings.sellerName?`<div>${settings.sellerName}</div>`:''}
        ${settings.businessPhone?`<div>📞 ${settings.businessPhone}</div>`:''}
      </div>
    </div>
    <div class="inv-label">
      <div class="big">INVOICE</div>
      <div class="id"># ${order.id}</div>
      <div class="date">${order.date}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Order Summary</div>
    <div class="info-grid">
      <div class="info-item"><label>BGMI UID</label><div class="val">${order.customerGameId}</div></div>
      <div class="info-item"><label>Total Pop</label><div class="val">${fmtK(order.quantity)}</div></div>
      <div class="info-item"><label>Items Sent</label><div class="val">${order.totalItems}</div></div>
      <div class="info-item"><label>Amount</label><div class="val" style="color:#5b6fff">${fmtRs(order.earnings)}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Billing</div>
    <table>
      <thead><tr><th>Description</th><th>Qty (Pop)</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>BGMI Popularity</strong><br><span style="font-size:10px;color:#888">${order.totalItems} items · Order ${order.id}</span></td>
          <td>${fmtK(order.quantity)}</td>
          <td>₹1 / 1K pop</td>
          <td><strong>${fmtRs(order.earnings)}</strong></td>
        </tr>
        <tr class="total-row">
          <td colspan="3">TOTAL AMOUNT</td>
          <td style="color:#5b6fff;font-size:16px">${fmtRs(order.earnings)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div class="pay-section">
      <div class="pay-title">PAYMENT DETAILS</div>
      <div style="font-size:12px;line-height:2">
        <div>Rate: <strong>1,000 Pop = ₹1</strong></div>
        ${settings.businessPhone?`<div>📞 Phone: <strong>${settings.businessPhone}</strong></div>`:''}
      </div>
      ${qrSection}
    </div>
    <div class="fulfilled-stamp">
      <div class="text">FULFILLED</div>
      <div class="sub">${order.date}</div>
    </div>
  </div>

  <div class="note">
    Thank you for your order! • BGMI Popularity Service • 1,000 Pop = ₹1
    ${settings.businessName?` • ${settings.businessName}`:''}
  </div>
</body>
</html>`;
};

export default function App() {
  const [bulkIds, setBulkIdsRaw] = useState([]);
  const [orders,  setOrdersRaw]  = useState([]);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [notif, setNotif]         = useState(null);

  const [custId,      setCustId]      = useState('');
  const [orderQty,    setOrderQty]    = useState('');
  const [orderPlan,   setOrderPlan]   = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  const [waOrder,      setWaOrder]      = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [copied,       setCopied]       = useState(false);

  // Settings with QR
  const [settings, setSettings] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('popstock_settings')||'{}'); } catch { return {}; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState({});
  const qrInputRef = useRef(null);

  const [showAdd,   setShowAdd]   = useState(false);
  const [addMode,   setAddMode]   = useState('range');
  const [newBulk,   setNewBulk]   = useState({id:'',itemSize:'1500',itemsPerID:'10',label:''});
  const [rangeForm, setRangeForm] = useState({prefix:'',from:'',to:'',itemSize:'1500',itemsPerID:'10'});
  const [editBulk,  setEditBulk]  = useState(null);
  const [showClear, setShowClear] = useState(false);
  const [search,    setSearch]    = useState('');

  useEffect(()=>{ setBulkIdsRaw(loadBulkIds()); setOrdersRaw(loadOrders()); },[]);

  const setBulkIds = (fn)=>setBulkIdsRaw(p=>{const n=typeof fn==='function'?fn(p):fn; saveBulkIds(n); return n;});
  const setOrders  = (fn)=>setOrdersRaw(p =>{const n=typeof fn==='function'?fn(p):fn; saveOrders(n);  return n;});
  const notify = (msg,type='success')=>{setNotif({msg,type});setTimeout(()=>setNotif(null),3500);};

  const openSettings = () => { setTempSettings({...settings}); setShowSettings(true); };

  // QR upload handler
  const handleQRUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Please upload an image file.','error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setTempSettings(p=>({...p, qrDataUrl: ev.target.result}));
    reader.readAsDataURL(file);
  };

  const saveSettings = () => {
    localStorage.setItem('popstock_settings', JSON.stringify(tempSettings));
    setSettings(tempSettings);
    setShowSettings(false);
    notify('Settings saved!');
  };

  const stats = useMemo(()=>{
    const totalPop  = bulkIds.reduce((a,b)=>a+(b.itemsPerID||10)*(b.itemSize||1500),0);
    const usedPop   = bulkIds.reduce((a,b)=>a+(b.usedItems||0)*(b.itemSize||1500),0);
    const available = totalPop-usedPop;
    const totalEarnings = orders.reduce((a,o)=>a+o.earnings,0);
    const totalSold = orders.reduce((a,o)=>a+o.quantity,0);
    return {totalPop,usedPop,available,totalEarnings,totalSold};
  },[bulkIds,orders]);

  useEffect(()=>{
    const qty=parseQty(orderQty);
    if (!qty||qty<=0){setOrderPlan(null);return;}
    setOrderPlan({qty,...planOrder(bulkIds,qty)});
  },[orderQty,bulkIds]);

  const handleOrder = ()=>{
    if (!custId.trim()){notify('Enter customer game ID.','error');return;}
    const qty=parseQty(orderQty);
    if (!qty||qty<=0){notify('Enter valid quantity.','error');return;}
    const result=planOrder(bulkIds,qty);
    if (!result.fulfilled){notify('Not enough stock!','error');return;}
    const earnings=parseFloat(popToRs(result.totalPop).toFixed(2));
    const newOrder={
      id:`ORD-${String(orders.length+1).padStart(4,'0')}`,
      customerGameId:custId, quantity:result.totalPop, targetQty:qty,
      plan:result.plan, idsUsed:result.plan.length, totalItems:result.totalItems,
      status:'Fulfilled', date:new Date().toISOString().split('T')[0], earnings,
    };
    setBulkIds(prev=>prev.map(b=>{
      const p=result.plan.find(x=>x.id===b.id);
      return p?{...b,usedItems:(b.usedItems||0)+p.itemsSent,usedStock:(b.usedStock||0)+p.popSent}:b;
    }));
    setOrders(prev=>[newOrder,...prev]);
    setOrderResult(newOrder);
    setCustId('');setOrderQty('');
    notify(`Order ${newOrder.id} fulfilled!`);
  };

  const handleAddSingle=()=>{
    if (!newBulk.id||!newBulk.itemSize||!newBulk.itemsPerID){notify('Fill all fields.','error');return;}
    if (bulkIds.find(b=>b.id===newBulk.id)){notify('ID already exists.','error');return;}
    const isz=parseInt(newBulk.itemSize),ipc=parseInt(newBulk.itemsPerID);
    setBulkIds(prev=>[...prev,{id:newBulk.id,label:newBulk.label||newBulk.id,itemSize:isz,itemsPerID:ipc,totalStock:isz*ipc,usedStock:0,usedItems:0}]);
    setNewBulk({id:'',itemSize:'1500',itemsPerID:'10',label:''});
    setShowAdd(false);
    notify(`Added ${newBulk.id}`);
  };

  const handleAddRange=()=>{
    const {prefix,from,to,itemSize,itemsPerID}=rangeForm;
    if (!prefix||!from||!to||!itemSize||!itemsPerID){notify('Fill all fields.','error');return;}
    const fromN=parseInt(from),toN=parseInt(to);
    if (fromN>toN){notify('"From" ≤ "To".','error');return;}
    if (toN-fromN>500){notify('Max 500 IDs.','error');return;}
    const isz=parseInt(itemSize),ipc=parseInt(itemsPerID);
    const entries=[],dupes=[];
    for (let i=fromN;i<=toN;i++){
      const id=`${prefix}${i}`;
      if (bulkIds.find(b=>b.id===id)) dupes.push(id);
      else entries.push({id,label:id,itemSize:isz,itemsPerID:ipc,totalStock:isz*ipc,usedStock:0,usedItems:0});
    }
    if (!entries.length){notify('All IDs exist.','error');return;}
    setBulkIds(prev=>[...prev,...entries]);
    setRangeForm({prefix:'',from:'',to:'',itemSize:'1500',itemsPerID:'10'});
    setShowAdd(false);
    notify(`✓ ${entries.length} IDs · ${fmtK(isz*ipc)} each · ${fmtK(isz*ipc*entries.length)} total`);
  };

  const handleUpdateBulk=()=>{
    const isz=parseInt(editBulk.itemSize),ipc=parseInt(editBulk.itemsPerID);
    setBulkIds(prev=>prev.map(b=>b.id===editBulk.id?{...b,label:editBulk.label,itemSize:isz,itemsPerID:ipc,totalStock:isz*ipc}:b));
    setEditBulk(null);notify('Updated!');
  };
  const handleDelete=(id)=>{if(window.confirm(`Delete ${id}?`)){setBulkIds(prev=>prev.filter(b=>b.id!==id));notify(`${id} deleted.`);}};

  const handleCopyWA=(order)=>{
    const msg=buildWhatsAppMsg(order,settings);
    navigator.clipboard.writeText(msg).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };
  const handlePrintInvoice=(order)=>{
    const html=buildInvoiceHTML(order,settings);
    const win=window.open('','_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(()=>win.print(),600);
  };

  const filteredOrders=orders.filter(o=>
    o.customerGameId.toLowerCase().includes(search.toLowerCase())||
    o.id.toLowerCase().includes(search.toLowerCase())
  );
  const exportCSV=()=>{
    const rows=orders.map(o=>`${o.id},${o.customerGameId},${o.quantity},${o.totalItems},${o.idsUsed},${o.earnings},${o.date}`);
    const csv=['Order ID,Customer ID,Pop Sent,Items,IDs Used,Earnings,Date',...rows].join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download=`popstock_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const rangeCount=rangeForm.from&&rangeForm.to?Math.max(0,parseInt(rangeForm.to||0)-parseInt(rangeForm.from||0)+1):0;
  const rangeTotal=rangeCount*(parseInt(rangeForm.itemSize||0)*parseInt(rangeForm.itemsPerID||0));

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      {notif&&<div className={`notif ${notif.type==='success'?'ns':'ne'}`}>{notif.msg}</div>}

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.logo}><span style={{color:'#5b6fff'}}>POP</span>STOCK</div>
          <div style={S.sub}>BGMI Popularity Manager · 1K Pop = ₹1 · {settings.businessName||'Setup in ⚙ Settings'}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-outline" onClick={openSettings}>⚙ Settings</button>
          <button className="btn-danger-sm" onClick={()=>setShowClear(true)}>🗑 Clear</button>
        </div>
      </div>

      <div style={S.tabBar}>
        {TABS.map(t=><button key={t} className={`tab-btn ${activeTab===t?'active':''}`} onClick={()=>{setActiveTab(t);setOrderResult(null);}}>{t}</button>)}
      </div>

      {/* ── SETTINGS MODAL ── */}
      {showSettings&&(
        <div style={S.modal}><div style={{...S.mbox,minWidth:520}}>
          <div className="card-title" style={{marginBottom:20}}>⚙ BUSINESS SETTINGS</div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
            {[
              {key:'businessName', lbl:'BUSINESS NAME',  ph:'e.g. VivoPop Store'},
              {key:'sellerName',   lbl:'YOUR NAME',       ph:'e.g. Rahul'},
              {key:'businessPhone',lbl:'PHONE / GPAY NO.',ph:'e.g. 9876543210'},
              {key:'businessUPI',  lbl:'UPI ID',          ph:'e.g. rahul@upi'},
            ].map(f=>(
              <div key={f.key}><div className="lbl">{f.lbl}</div>
              <input value={tempSettings[f.key]||''} onChange={e=>setTempSettings(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}/></div>
            ))}
          </div>

          {/* QR Upload */}
          <div style={{marginBottom:20}}>
            <div className="lbl" style={{marginBottom:8}}>PAYMENT QR CODE</div>
            <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <input ref={qrInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleQRUpload}/>
                <button className="btn-outline" style={{width:'100%',padding:'14px',marginBottom:8}} onClick={()=>qrInputRef.current.click()}>
                  📷 Upload QR Code Image
                </button>
                <div style={{fontSize:11,color:'#4a5278',fontFamily:'Space Mono,monospace'}}>
                  Upload your GPay / PhonePe / Paytm QR code.<br/>It will appear on invoices and WhatsApp messages.
                </div>
                {tempSettings.qrDataUrl&&(
                  <button className="btn-sm-danger" style={{marginTop:8}} onClick={()=>setTempSettings(p=>({...p,qrDataUrl:null}))}>Remove QR</button>
                )}
              </div>
              {tempSettings.qrDataUrl&&(
                <div style={{textAlign:'center'}}>
                  <img src={tempSettings.qrDataUrl} alt="QR" style={{width:110,height:110,borderRadius:8,border:'2px solid #1a2040',objectFit:'contain',background:'#fff'}}/>
                  <div style={{fontSize:10,color:'#00e5a0',fontFamily:'Space Mono,monospace',marginTop:6}}>✓ QR uploaded</div>
                </div>
              )}
            </div>
          </div>

          <div style={{display:'flex',gap:10}}>
            <button className="btn-primary" onClick={saveSettings}>Save Settings</button>
            <button className="btn-outline" onClick={()=>setShowSettings(false)}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* CLEAR */}
      {showClear&&(
        <div style={S.modal}><div style={S.mbox}>
          <div style={{fontSize:18,fontWeight:800,color:'#ff4d4d',marginBottom:10}}>⚠ Clear All Data?</div>
          <div style={{color:'#9ba3cc',marginBottom:20,fontSize:14}}>Permanently deletes all Bulk IDs, orders and earnings.</div>
          <div style={{display:'flex',gap:10}}>
            <button className="btn-danger" onClick={()=>{clearAllData();setBulkIdsRaw([]);setOrdersRaw([]);setShowClear(false);notify('Cleared.');}}>Yes, Delete Everything</button>
            <button className="btn-outline" onClick={()=>setShowClear(false)}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* EDIT BULK */}
      {editBulk&&(
        <div style={S.modal}><div style={S.mbox}>
          <div className="card-title" style={{marginBottom:16}}>EDIT {editBulk.id}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:16}}>
            {[{key:'label',lbl:'LABEL'},{key:'itemSize',lbl:'POP/ITEM'},{key:'itemsPerID',lbl:'ITEMS/ID'}].map(f=>(
              <div key={f.key}><div className="lbl">{f.lbl}</div><input value={editBulk[f.key]} onChange={e=>setEditBulk(p=>({...p,[f.key]:e.target.value}))}/></div>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button className="btn-primary" onClick={handleUpdateBulk}>Update</button>
            <button className="btn-outline" onClick={()=>setEditBulk(null)}>Cancel</button>
          </div>
        </div></div>
      )}

      {/* ── WHATSAPP MODAL ── */}
      {waOrder&&(
        <div style={S.modal}><div style={{...S.mbox,minWidth:500,maxWidth:540}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div style={{color:'#25D366',fontWeight:800,fontSize:15,fontFamily:'Syne,sans-serif'}}>💬 WhatsApp Message</div>
            <button className="btn-sm" onClick={()=>setWaOrder(null)}>✕ Close</button>
          </div>

          {/* Message preview */}
          <div style={{background:'#0d1020',borderRadius:10,padding:16,marginBottom:16,fontFamily:'Space Mono,monospace',fontSize:12,lineHeight:1.9,color:'#e8eaf0',whiteSpace:'pre-wrap',maxHeight:320,overflowY:'auto',border:'1px solid #1a2040'}}>
            {buildWhatsAppMsg(waOrder,settings)}
          </div>

          {/* QR preview in WA modal */}
          {settings.qrDataUrl&&(
            <div style={{background:'#0d1020',border:'1px solid #1a2040',borderRadius:10,padding:14,marginBottom:16,display:'flex',alignItems:'center',gap:16}}>
              <img src={settings.qrDataUrl} alt="QR" style={{width:80,height:80,borderRadius:6,border:'1px solid #1a2040',objectFit:'contain',background:'#fff'}}/>
              <div>
                <div style={{fontSize:11,color:'#4a5278',fontFamily:'Space Mono,monospace',marginBottom:4}}>QR CODE WILL BE SENT SEPARATELY</div>
                {settings.businessUPI&&<div style={{fontFamily:'Space Mono,monospace',fontSize:13,color:'#5b6fff',fontWeight:700}}>{settings.businessUPI}</div>}
                <div style={{fontSize:11,color:'#6b7299',fontFamily:'Space Mono,monospace',marginTop:4}}>Save QR image and send after copying message</div>
              </div>
            </div>
          )}

          {!settings.businessUPI&&!settings.qrDataUrl&&(
            <div style={{background:'#ffaa0010',border:'1px solid #ffaa0030',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#ffaa00',fontFamily:'Space Mono,monospace'}}>
              ⚠ No UPI or QR set. Add in ⚙ Settings.
            </div>
          )}

          <div style={{display:'flex',gap:10}}>
            <button style={{flex:1,background:'linear-gradient(135deg,#25D366,#128C7E)',border:'none',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13,padding:'12px',borderRadius:10,cursor:'pointer'}} onClick={()=>handleCopyWA(waOrder)}>
              {copied?'✓ Copied!':'📋 Copy Message'}
            </button>
            <button className="btn-outline" onClick={()=>{
              const msg=encodeURIComponent(buildWhatsAppMsg(waOrder,settings));
              window.open(`https://wa.me/?text=${msg}`,'_blank');
            }}>Open WhatsApp</button>
          </div>

          {settings.qrDataUrl&&(
            <button className="btn-outline" style={{width:'100%',marginTop:8}} onClick={()=>{
              const a=document.createElement('a');
              a.href=settings.qrDataUrl;
              a.download='payment_qr.png';
              a.click();
            }}>⬇ Download QR Image to Send</button>
          )}
        </div></div>
      )}

      {/* ── INVOICE MODAL ── */}
      {invoiceOrder&&(
        <div style={S.modal}><div style={{...S.mbox,minWidth:540,maxWidth:580}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div style={{color:'#5b6fff',fontWeight:800,fontSize:15,fontFamily:'Syne,sans-serif'}}>🧾 Invoice — {invoiceOrder.id}</div>
            <button className="btn-sm" onClick={()=>setInvoiceOrder(null)}>✕ Close</button>
          </div>

          {/* Invoice Preview */}
          <div style={{background:'#fff',borderRadius:10,padding:20,marginBottom:16,border:'1px solid #e0e0e0',color:'#111',maxHeight:420,overflowY:'auto'}}>
            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16,paddingBottom:12,borderBottom:'2px solid #111'}}>
              <div>
                <div style={{fontSize:22,fontWeight:800,fontFamily:'Syne,sans-serif'}}><span style={{color:'#5b6fff'}}>POP</span>STOCK</div>
                {settings.businessName&&<div style={{fontSize:12,color:'#555',marginTop:3}}>{settings.businessName}</div>}
                {settings.sellerName&&<div style={{fontSize:11,color:'#888'}}>{settings.sellerName}</div>}
                {settings.businessPhone&&<div style={{fontSize:11,color:'#888'}}>📞 {settings.businessPhone}</div>}
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20,fontWeight:800,fontFamily:'Syne,sans-serif'}}>INVOICE</div>
                <div style={{fontSize:12,color:'#666'}}>#{invoiceOrder.id}</div>
                <div style={{fontSize:11,color:'#888',marginTop:3}}>{invoiceOrder.date}</div>
              </div>
            </div>

            {/* Info grid */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:16,background:'#f8f8f8',borderRadius:8,padding:12,fontSize:12}}>
              <div><div style={{fontSize:9,color:'#888',letterSpacing:'0.08em',marginBottom:2}}>BGMI UID</div><strong>{invoiceOrder.customerGameId}</strong></div>
              <div><div style={{fontSize:9,color:'#888',letterSpacing:'0.08em',marginBottom:2}}>TOTAL POP</div><strong>{fmtK(invoiceOrder.quantity)}</strong></div>
              <div><div style={{fontSize:9,color:'#888',letterSpacing:'0.08em',marginBottom:2}}>ITEMS SENT</div><strong>{invoiceOrder.totalItems}</strong></div>
              <div><div style={{fontSize:9,color:'#888',letterSpacing:'0.08em',marginBottom:2}}>AMOUNT</div><strong style={{color:'#5b6fff'}}>{fmtRs(invoiceOrder.earnings)}</strong></div>
            </div>

            {/* Billing table */}
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,marginBottom:16}}>
              <thead><tr style={{background:'#111',color:'#fff'}}>
                <th style={{padding:'8px 10px',textAlign:'left'}}>Description</th>
                <th style={{padding:'8px 10px',textAlign:'center'}}>Qty</th>
                <th style={{padding:'8px 10px',textAlign:'center'}}>Rate</th>
                <th style={{padding:'8px 10px',textAlign:'right'}}>Amount</th>
              </tr></thead>
              <tbody>
                <tr style={{background:'#f8f8f8'}}>
                  <td style={{padding:'10px'}}><strong>BGMI Popularity</strong><br/><span style={{fontSize:10,color:'#888'}}>{invoiceOrder.totalItems} items · Order {invoiceOrder.id}</span></td>
                  <td style={{padding:'10px',textAlign:'center'}}>{fmtK(invoiceOrder.quantity)}</td>
                  <td style={{padding:'10px',textAlign:'center'}}>₹1/1K</td>
                  <td style={{padding:'10px',textAlign:'right'}}><strong>{fmtRs(invoiceOrder.earnings)}</strong></td>
                </tr>
                <tr style={{background:'#111',color:'#fff',fontWeight:700}}>
                  <td colSpan={3} style={{padding:'10px'}}>TOTAL</td>
                  <td style={{padding:'10px',textAlign:'right',color:'#5b6fff',fontSize:15}}>{fmtRs(invoiceOrder.earnings)}</td>
                </tr>
              </tbody>
            </table>

            {/* Payment section */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}>
              <div style={{fontSize:12,lineHeight:2}}>
                <div style={{fontSize:10,fontWeight:700,color:'#888',letterSpacing:'0.1em',marginBottom:6}}>PAYMENT DETAILS</div>
                <div>Rate: <strong>1,000 Pop = ₹1</strong></div>
                {settings.businessPhone&&<div>📞 <strong>{settings.businessPhone}</strong></div>}
                {settings.businessUPI&&<div>UPI: <strong style={{color:'#5b6fff',fontSize:14}}>{settings.businessUPI}</strong></div>}
              </div>
              {settings.qrDataUrl&&(
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#888',letterSpacing:'0.08em',marginBottom:6}}>SCAN TO PAY</div>
                  <img src={settings.qrDataUrl} alt="QR" style={{width:100,height:100,border:'2px solid #111',borderRadius:6,objectFit:'contain'}}/>
                </div>
              )}
              {!settings.qrDataUrl&&!settings.businessUPI&&(
                <div style={{background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'8px 12px',fontSize:11,color:'#856404'}}>
                  ⚠ Add UPI/QR in Settings
                </div>
              )}
            </div>
          </div>

          <div style={{display:'flex',gap:10}}>
            <button style={{flex:1,...btnInv}} onClick={()=>handlePrintInvoice(invoiceOrder)}>🖨 Print / Save PDF</button>
            <button className="btn-outline" onClick={()=>setInvoiceOrder(null)}>Close</button>
          </div>
          <div style={{fontSize:11,color:'#4a5278',fontFamily:'Space Mono,monospace',marginTop:8,textAlign:'center'}}>
            In print dialog → select "Save as PDF" to save invoice
          </div>
        </div></div>
      )}

      <div style={S.content}>

        {/* ══ DASHBOARD ══ */}
        {activeTab==='Dashboard'&&(<div>
          <div style={S.statsGrid}>
            {[
              {lbl:'TOTAL STOCK',    val:fmtK(stats.totalPop),       icon:'📦',col:'#5b6fff',sub:`${bulkIds.length} IDs`},
              {lbl:'AVAILABLE',      val:fmtK(stats.available),      icon:'✅', col:'#00e5a0',sub:fmtRs(popToRs(stats.available))},
              {lbl:'USED STOCK',     val:fmtK(stats.usedPop),        icon:'📤',col:'#ffaa00',sub:'sent'},
              {lbl:'TOTAL EARNINGS', val:fmtRs(stats.totalEarnings), icon:'💰',col:'#ff4d4d',sub:`${orders.length} orders`},
            ].map(s=>(<div key={s.lbl} className="stat-card"><div style={{fontSize:24,marginBottom:6}}>{s.icon}</div><div className="lbl">{s.lbl}</div><div style={{fontSize:24,fontWeight:800,color:s.col,fontFamily:'Space Mono,monospace'}}>{s.val}</div><div style={{fontSize:11,color:'#4a5278',fontFamily:'Space Mono,monospace',marginTop:3}}>{s.sub}</div></div>))}
          </div>
          <div style={{background:'#0d1020',border:'1px solid #1a2040',borderRadius:12,padding:'12px 20px',marginBottom:20,display:'flex',gap:32,flexWrap:'wrap'}}>
            <div><div className="lbl">RATE</div><div className="mono" style={{color:'#5b6fff',fontSize:14}}>1,000 Pop = ₹1</div></div>
            <div><div className="lbl">STOCK VALUE</div><div className="mono" style={{color:'#00e5a0',fontSize:14}}>{fmtRs(popToRs(stats.available))}</div></div>
            <div><div className="lbl">TOTAL SOLD</div><div className="mono" style={{color:'#ffaa00',fontSize:14}}>{fmtK(stats.totalSold)} pop</div></div>
            <div><div className="lbl">IDs</div><div className="mono" style={{color:'#e8eaf0',fontSize:14}}>{bulkIds.length}</div></div>
            {settings.businessUPI&&<div><div className="lbl">YOUR UPI</div><div className="mono" style={{color:'#5b6fff',fontSize:14}}>{settings.businessUPI}</div></div>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:20}}>
            <div className="card">
              <div className="card-title">BULK ID STOCK</div>
              {bulkIds.length===0&&<div className="empty-msg">No Bulk IDs yet.</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                {bulkIds.slice(0,30).map(b=>{
                  const ipc=b.itemsPerID||10,isz=b.itemSize||1500,usedIt=b.usedItems||0,availIt=ipc-usedIt;
                  const pct=ipc>0?usedIt/ipc:0,col=stockColor(usedIt,ipc);
                  return(<div key={b.id} style={{background:'#0d1020',borderRadius:8,padding:'8px 10px',border:'1px solid #1a2040'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                      <span className="mono" style={{color:'#5b6fff',fontSize:10,fontWeight:700}}>{b.id}</span>
                      <span className="mono" style={{fontSize:10,color:col}}>{availIt}/{ipc}</span>
                    </div>
                    <div style={{fontSize:9,color:'#4a5278',fontFamily:'Space Mono,monospace',marginBottom:3}}>{fmtK(availIt*isz)}</div>
                    <div className="progress-bar"><div style={{height:'100%',width:`${pct*100}%`,background:col,borderRadius:3}}/></div>
                  </div>);
                })}
              </div>
              {bulkIds.length>30&&<div className="empty-msg" style={{marginTop:10}}>+{bulkIds.length-30} more</div>}
            </div>
            <div className="card">
              <div className="card-title">RECENT ORDERS</div>
              {orders.length===0&&<div className="empty-msg">No orders yet.</div>}
              {orders.slice(0,6).map(o=>(
                <div key={o.id} style={S.orow}>
                  <div>
                    <div className="mono" style={{color:'#5b6fff',fontSize:11,fontWeight:700}}>{o.id}</div>
                    <div style={{fontSize:12,color:'#6b7299',marginTop:1}}>{o.customerGameId}</div>
                    <div style={{fontSize:10,color:'#4a5278',marginTop:1}}>{fmtK(o.quantity)} · {o.idsUsed} IDs</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="mono" style={{color:'#00e5a0',fontSize:14,fontWeight:700}}>{fmtRs(o.earnings)}</div>
                    <div style={{display:'flex',gap:6,marginTop:6,justifyContent:'flex-end'}}>
                      <button className="btn-wa" onClick={()=>setWaOrder(o)}>💬</button>
                      <button className="btn-inv" onClick={()=>setInvoiceOrder(o)}>🧾</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>)}

        {/* ══ STOCK MANAGER ══ */}
        {activeTab==='Stock Manager'&&(<div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div className="page-title">MANAGE BULK IDS · {bulkIds.length} IDs · {fmtK(stats.available)} available</div>
            <button className="btn-primary" onClick={()=>setShowAdd(!showAdd)}>+ Add Bulk IDs</button>
          </div>
          {showAdd&&(<div className="card" style={{marginBottom:20}}>
            <div style={{display:'flex',gap:8,marginBottom:18}}>
              <button className={addMode==='range'?'btn-primary':'btn-outline'} onClick={()=>setAddMode('range')}>📦 Bulk Range</button>
              <button className={addMode==='single'?'btn-primary':'btn-outline'} onClick={()=>setAddMode('single')}>➕ Single ID</button>
            </div>
            {addMode==='range'&&(<div>
              <div style={{background:'#0d1020',border:'1px solid #1a2040',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
                <div className="lbl" style={{marginBottom:6}}>PREVIEW</div>
                <div className="mono" style={{color:'#5b6fff',fontSize:13}}>{rangeForm.prefix||'vivopop'}{rangeForm.from||'1'} → {rangeForm.prefix||'vivopop'}{rangeForm.to||'100'}</div>
                {rangeForm.itemSize&&rangeForm.itemsPerID&&(
                  <div style={{marginTop:8,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                    <div><div className="lbl">POP/ITEM</div><div className="mono" style={{color:'#e8eaf0',fontSize:13}}>{fmtNum(parseInt(rangeForm.itemSize||0))}</div></div>
                    <div><div className="lbl">ITEMS/ID</div><div className="mono" style={{color:'#e8eaf0',fontSize:13}}>{rangeForm.itemsPerID}</div></div>
                    <div><div className="lbl">POP/ID</div><div className="mono" style={{color:'#ffaa00',fontSize:13}}>{fmtK(parseInt(rangeForm.itemSize||0)*parseInt(rangeForm.itemsPerID||0))}</div></div>
                    <div><div className="lbl">TOTAL ({rangeCount} IDs)</div><div className="mono" style={{color:'#00e5a0',fontSize:13}}>{fmtK(rangeTotal)}</div></div>
                  </div>
                )}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1.4fr 0.7fr 0.7fr 1fr 1fr',gap:14,marginBottom:14}}>
                {[{key:'prefix',lbl:'PREFIX',ph:'vivopop'},{key:'from',lbl:'FROM #',ph:'1'},{key:'to',lbl:'TO #',ph:'100'},{key:'itemSize',lbl:'POP/ITEM',ph:'1500'},{key:'itemsPerID',lbl:'ITEMS/ID',ph:'10'}].map(f=>(
                  <div key={f.key}><div className="lbl">{f.lbl}</div><input value={rangeForm[f.key]} onChange={e=>setRangeForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}/></div>
                ))}
              </div>
              <div style={{display:'flex',gap:10}}>
                <button className="btn-primary" onClick={handleAddRange}>Add {rangeCount>0?`${rangeCount} IDs`:''} {rangeTotal>0?`· ${fmtK(rangeTotal)} total`:''}</button>
                <button className="btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button>
              </div>
            </div>)}
            {addMode==='single'&&(<div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:14,marginBottom:14}}>
                {[{key:'id',lbl:'BULK ID',ph:'vivopop101'},{key:'itemSize',lbl:'POP/ITEM',ph:'1500'},{key:'itemsPerID',lbl:'ITEMS/ID',ph:'10'},{key:'label',lbl:'LABEL (opt)',ph:'Event name'}].map(f=>(
                  <div key={f.key}><div className="lbl">{f.lbl}</div><input value={newBulk[f.key]} onChange={e=>setNewBulk(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}/></div>
                ))}
              </div>
              <div style={{display:'flex',gap:10}}>
                <button className="btn-primary" onClick={handleAddSingle}>Save</button>
                <button className="btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button>
              </div>
            </div>)}
          </div>)}
          <div className="card">
            <table className="tbl">
              <thead><tr><th>BULK ID</th><th>POP/ITEM</th><th>ITEMS</th><th>USED</th><th>AVAIL</th><th>POP LEFT</th><th>₹ VALUE</th><th>STATUS</th><th></th></tr></thead>
              <tbody>
                {bulkIds.length===0&&<tr><td colSpan={9} style={{color:'#4a5278',textAlign:'center',padding:24}}>No Bulk IDs. Click "+ Add Bulk IDs".</td></tr>}
                {bulkIds.map(b=>{
                  const ipc=b.itemsPerID||10,isz=b.itemSize||1500,usedIt=b.usedItems||0,availIt=ipc-usedIt;
                  const pct=ipc>0?usedIt/ipc:0,col=stockColor(usedIt,ipc);
                  const bc=pct>=0.9?'badge-red':pct>=0.6?'badge-yellow':'badge-green';
                  return(<tr key={b.id}>
                    <td><span className="mono" style={{color:'#5b6fff',fontWeight:700}}>{b.id}</span></td>
                    <td className="mono" style={{color:'#9ba3cc'}}>{fmtNum(isz)}</td>
                    <td className="mono">{ipc}</td>
                    <td className="mono" style={{color:'#ffaa00'}}>{usedIt}</td>
                    <td className="mono" style={{color:col,fontWeight:700}}>{availIt}</td>
                    <td className="mono" style={{color:col}}>{fmtK(availIt*isz)}</td>
                    <td className="mono" style={{color:'#00e5a0'}}>{fmtRs(popToRs(availIt*isz))}</td>
                    <td><span className={`badge ${bc}`}>{pct>=1?'EMPTY':pct>=0.6?'LOW':'OK'}</span></td>
                    <td><div style={{display:'flex',gap:6}}>
                      <button className="btn-sm" onClick={()=>setEditBulk({...b,itemSize:String(b.itemSize||1500),itemsPerID:String(b.itemsPerID||10)})}>Edit</button>
                      <button className="btn-sm-danger" onClick={()=>handleDelete(b.id)}>Del</button>
                    </div></td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>)}

        {/* ══ NEW ORDER ══ */}
        {activeTab==='New Order'&&(<div style={{maxWidth:720}}>
          <div className="page-title" style={{marginBottom:20}}>FULFILL CUSTOMER ORDER</div>
          <div className="card">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:18}}>
              <div><div className="lbl">CUSTOMER BGMI UID</div><input value={custId} onChange={e=>setCustId(e.target.value)} placeholder="e.g. 5438272758"/></div>
              <div><div className="lbl">ORDER QUANTITY</div><input value={orderQty} onChange={e=>setOrderQty(e.target.value)} placeholder="e.g. 500K or 300000"/></div>
            </div>
            <div style={{marginBottom:18}}>
              <div className="lbl" style={{marginBottom:8}}>QUICK SELECT</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {['6K','15K','30K','60K','150K','300K','500K','600K'].map(q=>(
                  <button key={q} onClick={()=>setOrderQty(q)} style={{background:orderQty===q?'linear-gradient(135deg,#5b6fff,#8b5cf6)':'#0d1020',border:orderQty===q?'1.5px solid #5b6fff':'1.5px solid #1e2540',color:orderQty===q?'#fff':'#9ba3cc',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontFamily:'Space Mono,monospace',fontSize:12,fontWeight:700,transition:'all 0.15s'}}>{q}</button>
                ))}
              </div>
            </div>
            <div style={{background:'#0d1020',border:'1px solid #1a2040',borderRadius:12,padding:18,marginBottom:18}}>
              <div className="lbl" style={{marginBottom:12}}>📋 FULFILLMENT PLAN</div>
              {!orderPlan&&<div className="empty-msg">Enter quantity to see the plan.</div>}
              {orderPlan&&!orderPlan.fulfilled&&(<div style={{color:'#ff4d4d',fontFamily:'Space Mono,monospace',fontSize:13}}>⚠ Not enough stock! Need {fmtK(orderPlan.qty)}, have {fmtK(stats.available)}.</div>)}
              {orderPlan&&orderPlan.fulfilled&&(<div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:16,background:'#111420',borderRadius:10,padding:14}}>
                  <div><div className="lbl">TARGET</div><div className="mono" style={{color:'#9ba3cc',fontSize:14}}>{fmtK(orderPlan.qty)}</div></div>
                  <div><div className="lbl">ACTUAL</div><div className="mono" style={{color:'#e8eaf0',fontSize:14,fontWeight:700}}>{fmtK(orderPlan.totalPop)}</div></div>
                  <div><div className="lbl">ITEMS</div><div className="mono" style={{color:'#5b6fff',fontSize:14,fontWeight:700}}>{orderPlan.totalItems}</div></div>
                  <div><div className="lbl">IDs</div><div className="mono" style={{color:'#ffaa00',fontSize:14,fontWeight:700}}>{orderPlan.plan.length}</div></div>
                  <div><div className="lbl">EARNINGS</div><div className="mono" style={{color:'#00e5a0',fontSize:14,fontWeight:700}}>{fmtRs(popToRs(orderPlan.totalPop))}</div></div>
                </div>
                {orderPlan.totalPop>orderPlan.qty&&(<div style={{background:'#ffaa0010',border:'1px solid #ffaa0030',borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:12,color:'#ffaa00',fontFamily:'Space Mono,monospace'}}>ℹ Sending {fmtK(orderPlan.totalPop)} (rounded up to whole items)</div>)}
                <div className="lbl" style={{marginBottom:8}}>SEND FROM:</div>
                <div style={{maxHeight:280,overflowY:'auto',borderRadius:8,border:'1px solid #1a2040'}}>
                  {orderPlan.plan.map((p,i)=>(
                    <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:i%2===0?'#111420':'#0d1020',borderBottom:i<orderPlan.plan.length-1?'1px solid #1a2040':'none'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{color:'#2a3050',fontSize:11,fontFamily:'Space Mono,monospace',minWidth:24}}>#{i+1}</span>
                        <span className="mono" style={{color:'#5b6fff',fontWeight:700,fontSize:13}}>{p.id}</span>
                        {p.fullID&&<span className="badge badge-yellow" style={{fontSize:9}}>ALL</span>}
                      </div>
                      <div style={{display:'flex',gap:18}}>
                        <div><div className="lbl">ITEMS</div><div className="mono" style={{color:'#ffaa00',fontWeight:700,fontSize:15}}>{p.itemsSent}<span style={{color:'#2a3050',fontSize:11}}>/{p.totalItems}</span></div></div>
                        <div><div className="lbl">POP</div><div className="mono" style={{color:'#00e5a0',fontWeight:700,fontSize:15}}>{fmtK(p.popSent)}</div></div>
                        <div><div className="lbl">₹</div><div className="mono" style={{color:'#9ba3cc',fontSize:12}}>{fmtRs(popToRs(p.popSent))}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>)}
            </div>
            <button className="btn-primary btn-full" onClick={handleOrder} disabled={!orderPlan||!orderPlan.fulfilled||!custId.trim()} style={{opacity:(!orderPlan||!orderPlan.fulfilled||!custId.trim())?0.4:1,cursor:(!orderPlan||!orderPlan.fulfilled||!custId.trim())?'not-allowed':'pointer'}}>
              ⚡ CONFIRM & FULFILL ORDER
            </button>
          </div>
          {orderResult&&(
            <div className="card" style={{borderColor:'#00e5a030'}}>
              <div className="mono" style={{color:'#00e5a0',fontWeight:700,fontSize:14,marginBottom:14}}>✓ ORDER SAVED — {orderResult.id}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:16}}>
                <div><div className="lbl">CUSTOMER</div><div className="mono" style={{fontSize:12}}>{orderResult.customerGameId}</div></div>
                <div><div className="lbl">POP SENT</div><div className="mono" style={{fontSize:12,color:'#e8eaf0'}}>{fmtK(orderResult.quantity)}</div></div>
                <div><div className="lbl">ITEMS</div><div className="mono" style={{fontSize:12,color:'#ffaa00'}}>{orderResult.totalItems}</div></div>
                <div><div className="lbl">IDs USED</div><div className="mono" style={{fontSize:12,color:'#5b6fff'}}>{orderResult.idsUsed}</div></div>
                <div><div className="lbl">EARNINGS</div><div className="mono" style={{fontSize:12,color:'#00e5a0'}}>{fmtRs(orderResult.earnings)}</div></div>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button style={{flex:1,background:'linear-gradient(135deg,#25D366,#128C7E)',border:'none',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13,padding:'12px',borderRadius:10,cursor:'pointer'}} onClick={()=>setWaOrder(orderResult)}>💬 WhatsApp Message</button>
                <button style={{flex:1,...btnInv}} onClick={()=>setInvoiceOrder(orderResult)}>🧾 Generate Invoice</button>
              </div>
            </div>
          )}
        </div>)}

        {/* ══ ORDER HISTORY ══ */}
        {activeTab==='Order History'&&(<div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div className="page-title">{orders.length} TOTAL ORDERS</div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <input style={{width:200}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."/>
              <button className="btn-outline" onClick={exportCSV}>⬇ CSV</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20}}>
            {[
              {lbl:'TOTAL ORDERS',val:orders.length,col:'#5b6fff'},
              {lbl:'TOTAL EARNED',val:fmtRs(stats.totalEarnings),col:'#00e5a0'},
              {lbl:'POP SOLD',val:fmtK(stats.totalSold),col:'#ffaa00'},
              {lbl:'AVG ORDER',val:orders.length?fmtRs(stats.totalEarnings/orders.length):'₹0',col:'#ff4d4d'},
            ].map(s=>(<div key={s.lbl} className="stat-card"><div className="lbl">{s.lbl}</div><div style={{fontSize:20,fontWeight:800,color:s.col,fontFamily:'Space Mono,monospace'}}>{s.val}</div></div>))}
          </div>
          <div className="card">
            <table className="tbl">
              <thead><tr><th>ORDER ID</th><th>CUSTOMER</th><th>POP</th><th>ITEMS</th><th>IDs</th><th>EARNINGS</th><th>DATE</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {filteredOrders.length===0&&<tr><td colSpan={8} style={{color:'#4a5278',textAlign:'center',padding:24}}>No orders found.</td></tr>}
                {filteredOrders.map(o=>(
                  <tr key={o.id}>
                    <td><span className="mono" style={{color:'#5b6fff',fontWeight:700}}>{o.id}</span></td>
                    <td style={{color:'#9ba3cc'}}>{o.customerGameId}</td>
                    <td className="mono">{fmtK(o.quantity)}</td>
                    <td className="mono" style={{color:'#ffaa00'}}>{o.totalItems}</td>
                    <td className="mono" style={{color:'#5b6fff'}}>{o.idsUsed}</td>
                    <td><span className="mono" style={{color:'#00e5a0',fontWeight:700}}>{fmtRs(o.earnings)}</span></td>
                    <td className="mono" style={{color:'#4a5278'}}>{o.date}</td>
                    <td><div style={{display:'flex',gap:6}}>
                      <button className="btn-wa" onClick={()=>setWaOrder(o)}>💬</button>
                      <button className="btn-inv" onClick={()=>setInvoiceOrder(o)}>🧾</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>)}

      </div>
    </div>
  );
}

const btnInv={background:'linear-gradient(135deg,#5b6fff,#8b5cf6)',border:'none',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13,padding:'12px',borderRadius:10,cursor:'pointer'};

const S={
  app:      {minHeight:'100vh',background:'#0a0c14',color:'#e8eaf0',fontFamily:"'Syne','Trebuchet MS',sans-serif"},
  header:   {padding:'20px 32px',borderBottom:'1px solid #1a2040',display:'flex',alignItems:'center',justifyContent:'space-between'},
  logo:     {fontSize:24,fontWeight:800,color:'#fff',letterSpacing:'-0.02em'},
  sub:      {fontSize:11,color:'#4a5278',fontFamily:'Space Mono,monospace',marginTop:2},
  tabBar:   {padding:'0 32px',borderBottom:'1px solid #1a2040',display:'flex',gap:4},
  content:  {padding:'28px 32px',maxWidth:1200,margin:'0 auto'},
  statsGrid:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20},
  orow:     {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:12,borderBottom:'1px solid #1a2040'},
  modal:    {position:'fixed',inset:0,background:'#000000bb',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:20},
  mbox:     {background:'#111420',border:'1px solid #1a2040',borderRadius:16,padding:28,minWidth:420,maxHeight:'90vh',overflowY:'auto'},
};

const CSS=`
  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#111420}::-webkit-scrollbar-thumb{background:#2a3050;border-radius:3px}
  input{background:#131827!important;border:1.5px solid #1e2540!important;color:#e8eaf0!important;border-radius:8px!important;padding:10px 14px!important;font-family:'Space Mono',monospace!important;font-size:13px!important;width:100%;outline:none!important;transition:border .2s}
  input:focus{border-color:#5b6fff!important}
  .card{background:#111420;border:1px solid #1a2040;border-radius:16px;padding:24px;margin-bottom:16px}
  .card-title{font-weight:700;font-size:13px;color:#9ba3cc;letter-spacing:.06em;margin-bottom:18px}
  .page-title{font-size:13px;color:#4a5278;font-family:'Space Mono',monospace;font-weight:700;letter-spacing:.08em}
  .stat-card{background:#111420;border:1px solid #1a2040;border-radius:14px;padding:18px 20px}
  .empty-msg{color:#4a5278;font-family:'Space Mono',monospace;font-size:12px;padding:4px 0}
  .tab-btn{background:none;border:none;color:#6b7299;font-family:'Syne',sans-serif;font-size:14px;font-weight:600;padding:12px 20px;cursor:pointer;border-radius:8px 8px 0 0;transition:all .2s}
  .tab-btn.active{background:#1a1f35;color:#fff}.tab-btn:hover:not(.active){color:#9ba3cc}
  .btn-primary{background:linear-gradient(135deg,#5b6fff,#8b5cf6);border:none;color:#fff;font-family:'Syne',sans-serif;font-weight:700;font-size:14px;padding:11px 24px;border-radius:10px;cursor:pointer;transition:opacity .2s}
  .btn-primary:hover{opacity:.85}.btn-full{width:100%;padding:14px!important;font-size:15px!important}
  .btn-outline{background:none;border:1.5px solid #2a3050;color:#9ba3cc;font-family:'Syne',sans-serif;font-size:13px;font-weight:600;padding:9px 18px;border-radius:8px;cursor:pointer;transition:all .2s}
  .btn-outline:hover{border-color:#5b6fff;color:#fff}
  .btn-sm{background:none;border:1px solid #2a3050;color:#9ba3cc;font-size:11px;font-family:'Space Mono',monospace;padding:5px 12px;border-radius:6px;cursor:pointer}
  .btn-sm:hover{border-color:#5b6fff;color:#fff}
  .btn-sm-danger{background:none;border:1px solid #ff4d4d33;color:#ff4d4d;font-size:11px;font-family:'Space Mono',monospace;padding:5px 12px;border-radius:6px;cursor:pointer}
  .btn-danger{background:#ff4d4d22;border:1.5px solid #ff4d4d55;color:#ff4d4d;font-family:'Syne',sans-serif;font-weight:700;font-size:14px;padding:11px 22px;border-radius:10px;cursor:pointer}
  .btn-danger-sm{background:none;border:1px solid #ff4d4d33;color:#ff4d4d88;font-family:'Syne',sans-serif;font-size:12px;font-weight:600;padding:7px 14px;border-radius:8px;cursor:pointer}
  .btn-danger-sm:hover{border-color:#ff4d4d;color:#ff4d4d}
  .btn-wa{background:#25D36622;border:1px solid #25D36644;color:#25D366;font-size:14px;padding:4px 8px;border-radius:6px;cursor:pointer}
  .btn-wa:hover{background:#25D36633}
  .btn-inv{background:#5b6fff22;border:1px solid #5b6fff44;color:#5b6fff;font-size:14px;padding:4px 8px;border-radius:6px;cursor:pointer}
  .btn-inv:hover{background:#5b6fff33}
  .badge{display:inline-block;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;font-family:'Space Mono',monospace}
  .badge-green{background:#00e5a020;color:#00e5a0;border:1px solid #00e5a030}
  .badge-red{background:#ff4d4d20;color:#ff4d4d;border:1px solid #ff4d4d30}
  .badge-yellow{background:#ffaa0020;color:#ffaa00;border:1px solid #ffaa0030}
  .lbl{color:#4a5278;font-size:10px;font-weight:700;letter-spacing:.08em;font-family:'Space Mono',monospace;margin-bottom:4px;display:block}
  .mono{font-family:'Space Mono',monospace}
  .progress-bar{height:4px;background:#1a2040;border-radius:3px;overflow:hidden;margin-top:4px}
  .notif{position:fixed;top:20px;right:24px;padding:13px 22px;border-radius:12px;font-family:'Syne',sans-serif;font-size:14px;font-weight:600;z-index:9999;animation:slideIn .3s ease}
  .ns{background:#00e5a020;border:1px solid #00e5a050;color:#00e5a0}.ne{background:#ff4d4d20;border:1px solid #ff4d4d50;color:#ff4d4d}
  @keyframes slideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
  .tbl{width:100%;border-collapse:collapse}
  .tbl th{text-align:left;padding:10px 14px;color:#4a5278;font-size:11px;font-weight:700;letter-spacing:.1em;font-family:'Space Mono',monospace;border-bottom:1px solid #1a2040}
  .tbl td{padding:11px 14px;font-size:12px;border-bottom:1px solid #13182a;font-family:'Space Mono',monospace;vertical-align:top}
  .tbl tr:last-child td{border-bottom:none}.tbl tr:hover td{background:#131827}
`;

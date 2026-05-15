import { useState, useEffect, useRef } from "react";

const CLAUDE_MODEL = "claude-sonnet-4-5";
const STORAGE_KEY = "smart_pantry_v2";
const SETTINGS_KEY = "smart_pantry_settings_v2";

const EMOJI_MAP = {
  milk:"🥛",cheese:"🧀",butter:"🧈",egg:"🥚",eggs:"🥚",yogurt:"🍶",cream:"🍦",
  water:"💧",juice:"🧃",soda:"🥤",beer:"🍺",wine:"🍷",coffee:"☕",tea:"🍵",
  rice:"🍚",bread:"🍞",pasta:"🍝",noodle:"🍜",flour:"🌾",sugar:"🍬",salt:"🧂",
  pepper:"🌶️",oil:"🫙",sauce:"🫙",ketchup:"🍅",mayo:"🫙",mustard:"🌭",
  chicken:"🍗",beef:"🥩",pork:"🥓",bacon:"🥓",fish:"🐟",salmon:"🍣",shrimp:"🦐",tuna:"🐟",
  apple:"🍎",banana:"🍌",orange:"🍊",lemon:"🍋",grape:"🍇",strawberry:"🍓",
  blueberry:"🫐",tomato:"🍅",potato:"🥔",carrot:"🥕",onion:"🧅",garlic:"🧄",
  broccoli:"🥦",spinach:"🥬",lettuce:"🥗",corn:"🌽",mushroom:"🍄",avocado:"🥑",
  cucumber:"🥒",beans:"🫘",lentils:"🫘",chickpea:"🫘",
  chocolate:"🍫",candy:"🍬",cookie:"🍪",cake:"🎂",honey:"🍯",jam:"🍓",
  peanut:"🥜",almond:"🫘",walnut:"🌰",cereal:"🥣",oat:"🌾",oats:"🌾",
  soup:"🍲",pizza:"🍕",chips:"🥔",popcorn:"🍿",nuts:"🥜",soy:"🫙",tofu:"🥩",
};

const CATEGORIES = ["Dairy","Produce","Meat","Seafood","Bakery","Frozen","Pantry","Beverages","Snacks","Condiments","Other"];
const STORAGE_TYPES = ["Fridge","Pantry","Frozen","Other"];
const UNITS = ["pcs","g","kg","ml","L","oz","lb","pack","box","can","bottle","bag","bunch","dozen"];

const DEFAULT_SETTINGS = {
  expiresSoonDays: 7,
  defaultExpiryByCategory: {
    Dairy:7,Produce:5,Meat:3,Seafood:2,Bakery:5,Frozen:180,Pantry:365,
    Beverages:30,Snacks:60,Condiments:90,Other:30,
  }
};

function getEmoji(name="", category="") {
  const lower = name.toLowerCase();
  for (const [k,v] of Object.entries(EMOJI_MAP)) if (lower.includes(k)) return v;
  return {Dairy:"🧀",Produce:"🥬",Meat:"🥩",Seafood:"🐟",Bakery:"🍞",Frozen:"❄️",
    Pantry:"🥫",Beverages:"🥤",Snacks:"🍿",Condiments:"🫙",Other:"📦"}[category] || "📦";
}

function getDays(expiryDate) {
  if (!expiryDate) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const exp = new Date(expiryDate); exp.setHours(0,0,0,0);
  return Math.ceil((exp - now) / 86400000);
}

function getStatus(days, storageType) {
  if (storageType === "Frozen") return "frozen";
  if (days === null) return "good";
  if (days < 0) return "expired";
  if (days <= 7) return "soon";
  return "good";
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

const S = {
  soon:    { label:"Expires Soon", dot:"#F59E0B", bg:"#FFFBEB", border:"#FDE68A", text:"#B45309", bar:"#F59E0B" },
  expired: { label:"Expired",      dot:"#EF4444", bg:"#FEF2F2", border:"#FECACA", text:"#DC2626", bar:"#EF4444" },
  frozen:  { label:"Frozen",       dot:"#60A5FA", bg:"#EFF6FF", border:"#BFDBFE", text:"#2563EB", bar:"#60A5FA" },
  good:    { label:"Fresh",        dot:"#34D399", bg:"#F0FDF4", border:"#A7F3D0", text:"#059669", bar:"#34D399" },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
html{height:-webkit-fill-available;}
html,body{overscroll-behavior:none;background:#F4F6F9;min-height:100vh;min-height:-webkit-fill-available;}
input,select,textarea,button{font-family:-apple-system,'SF Pro Display','SF Pro Text',BlinkMacSystemFont,sans-serif;}
button{cursor:pointer;border:none;}
::-webkit-scrollbar{display:none;}

.page{padding:0 16px 16px;}

.glass{
  background:#FFFFFF;
  border:1px solid #E5E9F0;
  border-radius:24px;
  box-shadow:0 2px 12px rgba(30,40,60,0.06);
}
.glass-light{
  background:#FFFFFF;
  border:1px solid #E8ECF3;
  border-radius:24px;
  box-shadow:0 4px 20px rgba(30,40,60,0.07), 0 1px 4px rgba(30,40,60,0.04);
}

.row{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #F0F3F8;cursor:pointer;transition:background .12s;}
.row:last-child{border-bottom:none;}
.row:active{background:#F7F9FC;}

.inp{
  width:100%;padding:14px 16px;
  border:1.5px solid #E2E8F0;
  border-radius:16px;font-size:16px;
  background:#F8FAFC;outline:none;
  transition:all .15s;color:#1E293B;
  font-weight:600;
}
.inp:focus{border-color:#64748B;background:white;box-shadow:0 0 0 4px rgba(100,116,139,0.1);}
.sel{
  width:100%;padding:14px 16px;
  border:1.5px solid #E2E8F0;
  border-radius:16px;font-size:16px;
  background:#F8FAFC;outline:none;
  color:#1E293B;font-weight:600;
  -webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748B' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;
}
.sel:focus{border-color:#64748B;background:white;box-shadow:0 0 0 4px rgba(100,116,139,0.1);}

.btn-p{
  background:#1E293B;
  color:white;padding:16px;border-radius:18px;
  font-size:16px;font-weight:800;width:100%;
  transition:all .15s;letter-spacing:0.01em;
}
.btn-p:active{transform:scale(0.97);opacity:0.9;}
.btn-s{
  background:#F1F5F9;color:#475569;
  padding:16px;border-radius:18px;
  font-size:16px;font-weight:700;width:100%;
  transition:all .15s;border:1px solid #E2E8F0;
}
.btn-s:active{transform:scale(0.97);}
.btn-sm{
  background:#F1F5F9;color:#475569;
  padding:8px 16px;border-radius:12px;
  font-size:14px;font-weight:700;
  transition:all .15s;border:1px solid #E2E8F0;
}
.btn-sm:active{transform:scale(0.95);}
.btn-danger{background:#FEF2F2;color:#DC2626;padding:16px;border-radius:18px;font-size:16px;font-weight:700;width:100%;transition:all .15s;border:1px solid #FECACA;}
.btn-danger:active{transform:scale(0.97);}

.nav{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:430px;
  background:rgba(244,246,249,0.95);
  border-top:1px solid #E2E8F0;
  display:flex;z-index:100;
  padding-bottom:env(safe-area-inset-bottom,0);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
}
.nv{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 0 8px;gap:3px;background:none;border:none;transition:all .15s;}
.nv em{font-size:22px;font-style:normal;line-height:1;transition:transform .15s;}
.nv.active em{transform:scale(1.15);}
.nv span{font-size:10px;font-weight:800;letter-spacing:0.05em;}

.sheet-bg{position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:200;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}
.sheet{background:#F8FAFC;border-radius:32px 32px 0 0;width:100%;max-width:430px;max-height:93vh;overflow-y:auto;padding:20px 20px calc(44px + env(safe-area-inset-bottom,0));}
.handle{width:44px;height:5px;background:#CBD5E1;border-radius:99px;margin:0 auto 24px;}

.badge{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:99px;font-size:12px;font-weight:800;}
.dot{width:7px;height:7px;border-radius:99px;flex-shrink:0;}

.sec{font-size:11px;font-weight:900;color:#94A3B8;letter-spacing:0.12em;text-transform:uppercase;margin:22px 0 10px 2px;}
.sec-dark{font-size:11px;font-weight:900;color:#94A3B8;letter-spacing:0.1em;text-transform:uppercase;margin:20px 0 10px 2px;}
.lbl{font-size:11px;font-weight:800;color:#94A3B8;letter-spacing:0.07em;display:block;margin-bottom:7px;text-transform:uppercase;}

.chip{flex-shrink:0;padding:8px 16px;border-radius:99px;border:none;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;transition:all .15s;}

.bar-track{height:3px;background:#E2E8F0;border-radius:99px;overflow:hidden;margin-top:7px;}
.bar-fill{height:100%;border-radius:99px;transition:width .3s;}

.pill{display:inline-flex;align-items:center;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:800;}

@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.sheet{animation:slideUp 0.28s cubic-bezier(.22,1,.36,1);}
.sheet-bg{animation:fadeIn 0.2s ease;}
`;

// ─── GRADIENT BG ─────────────────────────────────────────────────────────────
const BG = {
  background: "#F4F6F9",
  minHeight: "100dvh",
  maxWidth: 430,
  margin: "0 auto",
  paddingBottom: 90,
  position: "relative",
  fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', BlinkMacSystemFont, sans-serif",
};

export default function App() {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]; } catch { return []; }});
  const [settings, setSettings] = useState(() => { try { return {...DEFAULT_SETTINGS,...(JSON.parse(localStorage.getItem(SETTINGS_KEY))||{})}; } catch { return DEFAULT_SETTINGS; }});
  const [tab, setTab] = useState("home");
  const [modal, setModal] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [statFilter, setStatFilter] = useState(null); // null | "all" | "soon" | "frozen" | "pantry"

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  const enriched = items.map(i => {
    const days = getDays(i.expiryDate);
    return {...i, days, status: getStatus(days, i.storageType)};
  });

  const sum = {
    total: enriched.length,
    soon: enriched.filter(i=>i.status==="soon").length,
    expired: enriched.filter(i=>i.status==="expired").length,
    frozen: enriched.filter(i=>i.storageType==="Frozen").length,
    pantry: enriched.filter(i=>i.storageType==="Pantry").length,
  };

  function saveItem(item) {
    const emoji = item.emoji || getEmoji(item.name, item.category);
    if (item.id) setItems(p=>p.map(i=>i.id===item.id?{...item,emoji}:i));
    else setItems(p=>[...p,{...item,id:genId(),emoji}]);
    closeModal();
  }
  function deleteItem(id) { setItems(p=>p.filter(i=>i.id!==id)); closeModal(); }
  function markUsed(id) { setItems(p=>p.map(i=>i.id===id?{...i,quantity:Math.max(0,i.quantity-1)}:i)); }
  function closeModal() { setModal(null); setActiveItem(null); }
  function openItem(item) { setActiveItem(item); setModal("item"); }
  function openEdit(item) { setActiveItem(item); setModal("edit"); }
  function openAdd() { setActiveItem(null); setModal("add"); }

  const filtered = enriched
    .filter(i=>filterCat==="All"||i.category===filterCat)
    .filter(i=>i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      if (a.storageType==="Frozen"&&b.storageType!=="Frozen") return 1;
      if (b.storageType==="Frozen"&&a.storageType!=="Frozen") return -1;
      return (a.days??99999)-(b.days??99999);
    });

  const urgent = enriched.filter(i=>i.status==="expired"||i.status==="soon").sort((a,b)=>(a.days??0)-(b.days??0));
  const frozen = enriched.filter(i=>i.storageType==="Frozen");
  const good   = enriched.filter(i=>i.status==="good"&&i.storageType!=="Frozen");

  const navItems = [["home","🏠","Home"],["inventory","📋","Items"],["scan","📷","Scan"],["settings","⚙️","More"]];

  return (
    <div style={BG}>
      <style>{CSS}</style>
      <div style={{height:"env(safe-area-inset-top,0)"}}/>

      <div style={{height:"env(safe-area-inset-top,0)"}}/>
      {/* ── PAGES ── */}
      {tab==="home"      && <HomePage enriched={enriched} sum={sum} urgent={urgent} frozen={frozen} good={good} onItem={openItem} onAdd={openAdd} onStatClick={(statFilter)=>{setFilterCat("All");setSearch("");setStatFilter(statFilter);setTab("inventory");}}/>}
      {tab==="inventory" && <InventoryPage filtered={filtered} search={search} setSearch={setSearch} filterCat={filterCat} setFilterCat={setFilterCat} statFilter={statFilter} setStatFilter={setStatFilter} enriched={enriched} onItem={openItem} onBack={()=>{setStatFilter(null);setTab("home");}}/>}
      {tab==="scan"      && <ScanPage settings={settings} onSaved={newItems=>{setItems(p=>[...p,...newItems]);setTab("home");}}/>}
      {tab==="settings"  && <SettingsPage settings={settings} setSettings={setSettings} items={items} setItems={setItems}/>}

      {/* ── NAV ── */}
      <nav className="nav">
        {navItems.map(([key,icon,label])=>(
          <button key={key} className={`nv${tab===key?" active":""}`} onClick={()=>setTab(key)}
            style={{color:tab===key?"#1E293B":"#94A3B8"}}>
            <em>{icon}</em>
            <span style={{color:tab===key?"#1E293B":"#CBD5E1"}}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── MODALS ── */}
      {(modal==="add"||modal==="edit") && (
        <div className="sheet-bg" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:20,fontWeight:900,marginBottom:22,color:"#1E293B",letterSpacing:"-0.01em"}}>
              {modal==="edit"?"Edit Item ✏️":"New Item ✨"}
            </div>
            <ItemForm item={activeItem} settings={settings} onSave={saveItem} onCancel={closeModal}/>
          </div>
        </div>
      )}
      {modal==="item" && activeItem && (
        <ItemSheet
          item={enriched.find(i=>i.id===activeItem.id)||activeItem}
          onEdit={()=>openEdit(activeItem)}
          onDelete={()=>deleteItem(activeItem.id)}
          onUsed={()=>markUsed(activeItem.id)}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// ─── Home Page ───────────────────────────────────────────────────────────────
function HomePage({enriched,sum,urgent,frozen,good,onItem,onAdd,onStatClick}) {
  return (
    <div className="page" style={{paddingTop:28}}>

      {/* Title row */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div style={{fontSize:32,fontWeight:700,color:"#1E293B",letterSpacing:"-0.02em"}}>My Pantry</div>
        <button onClick={onAdd} style={{
          background:"#1E293B",color:"white",border:"none",
          borderRadius:16,padding:"12px 22px",fontSize:16,fontWeight:600,
          display:"flex",alignItems:"center",gap:6,
        }}>＋ Add</button>
      </div>

      {/* Stat cards — tappable */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:24}}>
        {[
          {label:"Total Items",  val:sum.total,  icon:"📦", bg:"#1E293B", fg:"#F8FAFC", filter:"all"},
          {label:"Expiring Soon",val:sum.soon,   icon:"⏰", bg:"#9F1239", fg:"#FFF1F2", filter:"soon"},
          {label:"Frozen",       val:sum.frozen, icon:"❄️", bg:"#1E3A5F", fg:"#EFF6FF", filter:"frozen"},
          {label:"Pantry",       val:sum.pantry, icon:"🥫", bg:"#166534", fg:"#F0FDF4", filter:"pantry"},
        ].map(({label,val,icon,bg,fg,filter})=>(
          <div key={label} onClick={()=>onStatClick(filter)}
            style={{background:bg,borderRadius:24,padding:"22px 20px",cursor:"pointer",
              transition:"transform .15s",userSelect:"none",
              display:"flex",flexDirection:"column",gap:10,minHeight:130}}
            onTouchStart={e=>e.currentTarget.style.transform="scale(0.96)"}
            onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
            <div style={{fontSize:28}}>{icon}</div>
            <div style={{fontSize:36,fontWeight:700,color:fg,lineHeight:1,letterSpacing:"-0.02em"}}>{val}</div>
            <div style={{fontSize:13,color:`${fg}90`,fontWeight:500}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Urgent */}
      {urgent.length > 0 && <>
        <div style={{marginTop:20}}/>
        <div className="glass-light">
          {urgent.map(i=><ItemRow key={i.id} item={i} onClick={()=>onItem(i)}/>)}
        </div>
      </>}

      {/* Good */}
      {good.length > 0 && <>
        <div style={{marginTop:16}}/>
        <div className="glass-light">
          {good.slice(0,10).map(i=><ItemRow key={i.id} item={i} onClick={()=>onItem(i)}/>)}
          {good.length>10 && (
            <div style={{padding:"13px 18px",textAlign:"center",color:"#94A3B8",fontSize:13,fontWeight:700,borderTop:"1px solid #F0F3F8"}}>
              +{good.length-10} more items
            </div>
          )}
        </div>
      </>}

      {/* Frozen */}
      {frozen.length > 0 && <>
        <div style={{marginTop:16}}/>
        <div className="glass-light">
          {frozen.map(i=><ItemRow key={i.id} item={i} onClick={()=>onItem(i)}/>)}
        </div>
      </>}

      {enriched.length === 0 && (
        <div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:48,marginBottom:12}}>🛒</div>
          <div style={{fontSize:20,fontWeight:900,color:"#1E293B",marginBottom:6,letterSpacing:"-0.01em"}}>Pantry is empty</div>
          <div style={{color:"#94A3B8",marginBottom:24,fontSize:14,fontWeight:600}}>Scan a receipt or add your first item.</div>
          <button className="btn-p" onClick={onAdd} style={{maxWidth:200,margin:"0 auto",display:"block"}}>＋ Add First Item</button>
        </div>
      )}
    </div>
  );
}

// ─── Inventory Page ───────────────────────────────────────────────────────────
function InventoryPage({filtered,search,setSearch,filterCat,setFilterCat,statFilter,setStatFilter,enriched,onItem,onBack}) {
  const displayItems = (() => {
    const base = statFilter && statFilter !== "all" ? enriched
      .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
      .filter(i => filterCat === "All" || i.category === filterCat)
      : filtered;
    if (!statFilter || statFilter === "all") return base;
    if (statFilter === "soon")   return base.filter(i => i.status === "soon" || i.status === "expired");
    if (statFilter === "frozen") return base.filter(i => i.storageType === "Frozen");
    if (statFilter === "pantry") return base.filter(i => i.storageType === "Pantry");
    return base;
  })();

  const titleMap = { all:"All Items", soon:"Expiring Soon", frozen:"Frozen", pantry:"Pantry Items" };
  const iconMap  = { all:"📦", soon:"⏰", frozen:"❄️", pantry:"🥫" };
  const hasFilter = statFilter && statFilter !== "all";

  return (
    <div className="page" style={{paddingTop:20}}>

      {/* Header row — always shows back + title */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={onBack} style={{
          background:"#E2E8F0",border:"none",borderRadius:12,
          padding:"8px 12px",fontSize:18,fontWeight:800,color:"#475569",
          display:"flex",alignItems:"center",cursor:"pointer",flexShrink:0,
        }}>←</button>
        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
          <span style={{fontSize:20,flexShrink:0}}>{hasFilter ? iconMap[statFilter] : "📋"}</span>
          <span style={{fontSize:17,fontWeight:900,color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {hasFilter ? titleMap[statFilter] : "All Items"}
          </span>
          <span style={{fontSize:13,color:"#94A3B8",fontWeight:700,flexShrink:0}}>({displayItems.length})</span>
        </div>
      </div>

      <div style={{position:"relative",marginBottom:14}}>
        <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:16,pointerEvents:"none"}}>🔍</span>
        <input className="inp" placeholder="Search items…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:44}}/>
      </div>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:12,marginBottom:4}}>
        {["All",...CATEGORIES].map(c=>(
          <button key={c} className="chip" onClick={()=>setFilterCat(c)} style={{
            background:filterCat===c?"#1E293B":"#E2E8F0",
            color:filterCat===c?"#F8FAFC":"#64748B",
            border:filterCat===c?"none":"1px solid #CBD5E1",
          }}>{c}</button>
        ))}
      </div>

      {displayItems.length===0
        ? <div style={{textAlign:"center",padding:"60px 20px",color:"#94A3B8",fontWeight:700,fontSize:15}}>No items found.</div>
        : <div className="glass-light">{displayItems.map(i=><ItemRow key={i.id} item={i} onClick={()=>onItem(i)}/>)}</div>
      }
    </div>
  );
}

// ─── Scan Page ────────────────────────────────────────────────────────────────
function ScanPage({settings,onSaved}) {
  const [file,setFile]=useState(null);
  const [preview,setPreview]=useState(null);
  const [fileData,setFileData]=useState(null); // {base64, mediaType} read eagerly at pick time
  const [scanning,setScanning]=useState(false);
  const [error,setError]=useState("");
  const [extracted,setExtracted]=useState([]);
  const fileRef=useRef(); const camRef=useRef();

  function pick(f){
    if(!f)return;
    setError("");setExtracted([]);
    setPreview(URL.createObjectURL(f));
    // Read immediately on iOS before the file reference can be lost
    const r=new FileReader();
    r.onload=()=>{
      const dataUrl=r.result;
      const base64=dataUrl.split(",")[1];
      const rawType=f.type||"";
      const mediaType=["image/jpeg","image/png","image/gif","image/webp"].includes(rawType)
        ?rawType:(dataUrl.split(";")[0].replace("data:","")||"image/jpeg");
      setFile(f);
      setFileData({base64,mediaType,name:f.name,size:f.size});
    };
    r.onerror=()=>setError("Could not read file. Please try another image.");
    r.readAsDataURL(f);
  }

  async function scan(){
    if(!fileData)return;
    setScanning(true);setError("");setExtracted([]);
    try{
      const {base64,mediaType}=fileData;
      const today=new Date().toISOString().split("T")[0];
      const res=await fetch("/api/claude",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:CLAUDE_MODEL,max_tokens:2048,
          system:`You are a receipt OCR assistant. Today is ${today}. Output ONLY a raw JSON array starting with [ and ending with ]. No prose, no markdown.`,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:mediaType,data:base64}},
            {type:"text",text:`Extract every grocery/household item. For each: name(string), quantity(number,default 1), unit(pcs/lb/kg/g/L/ml/oz/gal/doz/pack/box/can/bag), category(Dairy|Produce|Meat|Seafood|Bakery|Frozen|Pantry|Beverages|Snacks|Condiments|Other), storageType(Fridge|Pantry|Frozen|Other), purchaseDate("${today}"), expiryDate(YYYY-MM-DD: bananas 5d,milk 10d,eggs 21d,bread 7d,coffee 180d), notes(""). Output ONLY the JSON array.`}
          ]}]
        })
      });
      if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error?.message||`API error ${res.status}`);}
      const data=await res.json();
      if(data.error)throw new Error(data.error.message);
      const raw=data.content.map(c=>c.text||"").join("").trim();
      const match=raw.match(/\[[\s\S]*\]/);
      if(!match)throw new Error("No items found. Try a clearer photo.");
      const parsed=JSON.parse(match[0].replace(/```json|```/g,"").trim());
      if(!Array.isArray(parsed)||!parsed.length)throw new Error("No grocery items detected.");
      setExtracted(parsed.map(item=>({...item,id:genId(),emoji:getEmoji(item.name,item.category),selected:true,quantity:Number(item.quantity)||1})));
    }catch(e){setError(e.message||"Scan failed.");}
    setScanning(false);
  }

  if(extracted.length>0) return (
    <div className="page" style={{paddingTop:20}}>
      <div style={{fontSize:22,fontWeight:900,color:"#1E293B",marginBottom:4,letterSpacing:"-0.01em"}}>Found {extracted.length} items 🎉</div>
      <div style={{color:"#94A3B8",fontSize:14,fontWeight:600,marginBottom:16}}>Tap items to deselect before adding.</div>
      <div className="glass-light" style={{marginBottom:16}}>
        {extracted.map((item,idx)=>(
          <div key={item.id} className="row" onClick={()=>setExtracted(p=>p.map((i,j)=>j===idx?{...i,selected:!i.selected}:i))}
            style={{opacity:item.selected?1:0.4}}>
            <div style={{fontSize:22}}>{item.selected?"✅":"⬜"}</div>
            <div style={{fontSize:26}}>{item.emoji}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:15,color:"#1E293B"}}>{item.name}</div>
              <div style={{color:"#94A3B8",fontSize:13,fontWeight:600}}>{item.quantity} {item.unit} · {item.category}</div>
              <div style={{color:"#CBD5E1",fontSize:12,fontWeight:600}}>Expires: {item.expiryDate||"Unknown"}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-p" style={{marginBottom:12}} onClick={()=>onSaved(extracted.filter(i=>i.selected).map(({selected,...i})=>i))}>
        ✓ Add {extracted.filter(i=>i.selected).length} Items to Pantry
      </button>
      <button className="btn-s" onClick={()=>{setExtracted([]);setFile(null);setFileData(null);setPreview(null);}}>↩ Scan Another</button>
    </div>
  );

  return (
    <div className="page" style={{paddingTop:20}}>
      <div style={{fontSize:22,fontWeight:900,color:"#1E293B",marginBottom:4,letterSpacing:"-0.01em"}}>Scan Receipt 📷</div>
      <div style={{color:"#94A3B8",fontSize:14,fontWeight:600,marginBottom:22}}>Take a photo or pick from gallery.</div>

      {!fileData ? <>
        {/* Show a loading state briefly while FileReader runs */}
        {file && !fileData && (
          <div style={{textAlign:"center",padding:"20px 0",color:"#94A3B8",fontWeight:700}}>Loading…</div>
        )}
        <button onClick={()=>camRef.current?.click()} style={{
          background:"#1E293B",
          color:"#F8FAFC",border:"none",borderRadius:28,padding:"36px 20px",
          display:"flex",flexDirection:"column",alignItems:"center",gap:12,
          width:"100%",cursor:"pointer",marginBottom:16,
          transition:"transform .15s",
        }}
          onTouchStart={e=>e.currentTarget.style.transform="scale(0.97)"}
          onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
          <div style={{fontSize:60,lineHeight:1}}>📷</div>
          <div style={{fontSize:20,fontWeight:900,letterSpacing:"-0.01em"}}>Take a Photo</div>
          <div style={{fontSize:13,color:"rgba(248,250,252,0.6)",fontWeight:600}}>Point camera at your receipt</div>
        </button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>pick(e.target.files[0])}/>

        <div style={{display:"flex",alignItems:"center",gap:12,margin:"4px 0 16px"}}>
          <div style={{flex:1,height:1,background:"#E8E2DA"}}/>
          <span style={{color:"#CBD5E1",fontSize:13,fontWeight:700}}>or</span>
          <div style={{flex:1,height:1,background:"#E8E2DA"}}/>
        </div>

        <button onClick={()=>fileRef.current?.click()} style={{
          background:"#E2E8F0",color:"#475569",
          border:"1px solid #CBD5E1",borderRadius:18,
          padding:16,width:"100%",fontSize:16,fontWeight:700,
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        }}>🖼️ Choose from Gallery</button>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>pick(e.target.files[0])}/>
      </> : <>
        <div className="glass-light" style={{padding:20,marginBottom:16}}>
          {preview&&<img src={preview} alt="Receipt" style={{width:"100%",maxHeight:260,objectFit:"contain",borderRadius:18,marginBottom:14}}/>}
          <div style={{fontWeight:800,fontSize:15,color:"#1E293B",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fileData?.name||file?.name||"Receipt"}</div>
          <div style={{color:"#94A3B8",fontSize:13,fontWeight:600,marginBottom:16}}>{fileData?((fileData.size||0)/1024).toFixed(0):""} KB</div>
          {error&&(
            <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:16,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:14,color:"#DC2626",marginBottom:3}}>⚠️ Scan failed</div>
              <div style={{fontSize:13,color:"#B91C1C",fontWeight:600}}>{error}</div>
            </div>
          )}
          {scanning
            ? <div style={{textAlign:"center",padding:"24px 0"}}>
                <div style={{fontSize:48,animation:"pulse 1.5s ease infinite"}}>🔍</div>
                <div style={{fontWeight:800,marginTop:10,fontSize:16,color:"#1E293B"}}>Reading receipt…</div>
                <div style={{color:"#94A3B8",fontSize:13,fontWeight:600,marginTop:4}}>Extracting items & estimating expiry</div>
              </div>
            : <>
                <button className="btn-p" onClick={scan} style={{marginBottom:10}}>🔍 Extract Items</button>
                <button className="btn-s" onClick={()=>{setFile(null);setFileData(null);setPreview(null);setError("");}}>↩ Change Photo</button>
              </>
          }
        </div>
      </>}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────
function SettingsPage({settings,setSettings,items,setItems}) {
  return (
    <div className="page" style={{paddingTop:20}}>
      <div style={{fontSize:22,fontWeight:900,color:"#1E293B",marginBottom:22,letterSpacing:"-0.01em"}}>Settings ⚙️</div>

      <div className="glass" style={{padding:20,marginBottom:14}}>
        <div style={{fontWeight:900,fontSize:15,color:"#1E293B",marginBottom:16}}>⏰ Expiry Warning</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"#334155"}}>Days before expiry</div>
            <div style={{color:"#94A3B8",fontSize:13,fontWeight:600}}>Flag as "Expires Soon"</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button className="btn-sm" onClick={()=>setSettings(p=>({...p,expiresSoonDays:Math.max(1,p.expiresSoonDays-1)}))}>−</button>
            <span style={{fontWeight:900,fontSize:24,color:"#1E293B",minWidth:28,textAlign:"center"}}>{settings.expiresSoonDays}</span>
            <button className="btn-sm" onClick={()=>setSettings(p=>({...p,expiresSoonDays:Math.min(30,p.expiresSoonDays+1)}))}>+</button>
          </div>
        </div>
      </div>

      <div className="glass" style={{padding:20,marginBottom:14}}>
        <div style={{fontWeight:900,fontSize:15,color:"#1E293B",marginBottom:16}}>📅 Default Shelf Life (days)</div>
        {Object.entries(settings.defaultExpiryByCategory).map(([cat,days])=>(
          <div key={cat} style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:12,marginBottom:12,borderBottom:"1px solid #F0F3F8"}}>
            <span style={{fontWeight:700,fontSize:14,color:"#334155"}}>{cat}</span>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button className="btn-sm" onClick={()=>setSettings(p=>({...p,defaultExpiryByCategory:{...p.defaultExpiryByCategory,[cat]:Math.max(1,days-1)}}))}>−</button>
              <span style={{fontWeight:900,fontSize:16,color:"#1E293B",minWidth:36,textAlign:"center"}}>{days}</span>
              <button className="btn-sm" onClick={()=>setSettings(p=>({...p,defaultExpiryByCategory:{...p.defaultExpiryByCategory,[cat]:days+1}}))}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="glass" style={{padding:20,marginBottom:14}}>
        <div style={{fontWeight:900,fontSize:15,color:"#1E293B",marginBottom:4}}>📊 Data</div>
        <div style={{color:"#94A3B8",fontSize:13,fontWeight:600,marginBottom:16}}>{items.length} items on this device</div>
        <button onClick={()=>{if(confirm("Delete ALL items? Cannot be undone."))setItems([]);}}
          style={{background:"#FEF2F2",color:"#DC2626",border:"1px solid #FECACA",borderRadius:16,padding:"14px 16px",width:"100%",fontSize:15,fontWeight:700}}>
          🗑️ Clear All Items
        </button>
      </div>

      <div className="glass" style={{padding:20}}>
        <div style={{fontWeight:900,fontSize:15,color:"#1E293B",marginBottom:8}}>📱 Add to Home Screen</div>
        <div style={{color:"#94A3B8",fontSize:14,fontWeight:600,lineHeight:1.7}}>
          <span style={{color:"#475569"}}>iPhone:</span> Share → Add to Home Screen<br/>
          <span style={{color:"#475569"}}>Android:</span> Menu → Add to Home Screen
        </div>
      </div>
    </div>
  );
}

// ─── Item Row ────────────────────────────────────────────────────────────────
function ItemRow({item,onClick}) {
  const s = S[item.status] || S.good;
  const isLow = item.quantity <= 1;

  // Freshness bar: 0–100%
  let barPct = 100;
  if (item.days !== null && item.storageType !== "Frozen") {
    if (item.days < 0) barPct = 0;
    else {
      const total = item.category ? (DEFAULT_SETTINGS.defaultExpiryByCategory[item.category] || 30) : 30;
      barPct = Math.min(100, Math.max(0, Math.round((item.days / total) * 100)));
    }
  }

  return (
    <div className="row" onClick={onClick}>
      <div style={{
        width:46,height:46,borderRadius:16,
        background:s.bg,border:`1px solid ${s.border}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:24,flexShrink:0,
      }}>{item.emoji||"📦"}</div>

      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:15,color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
          <span style={{fontSize:13,color:"#64748B",fontWeight:500}}>{item.quantity} {item.unit}</span>
          <span style={{color:"#E2E8F0",fontSize:12}}>·</span>
          <span style={{fontSize:12,color:"#94A3B8",fontWeight:500}}>{item.category}</span>
        </div>
        {item.storageType !== "Frozen" && item.days !== null && (
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
            <div className="bar-track" style={{flex:1,margin:0}}>
              <div className="bar-fill" style={{width:`${barPct}%`,background:s.bar}}/>
            </div>
            <div style={{fontSize:11,color:item.days<0?"#EF4444":item.days<=3?"#F97316":item.days<=7?"#FBBF24":"#94A3B8",fontWeight:600,flexShrink:0}}>
              {item.days<0?`${Math.abs(item.days)}d ago`:item.days===0?"Today":item.days===1?"Tomorrow":`${item.days}d`}
            </div>
          </div>
        )}
      </div>

      <div style={{flexShrink:0,textAlign:"right",minWidth:56}}>
        <span className="badge" style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`,fontSize:10,display:"block"}}>
          <span className="dot" style={{background:s.dot}}/>
          {s.label}
        </span>
      </div>
    </div>
  );
}

// ─── Item Sheet ───────────────────────────────────────────────────────────────
function ItemSheet({item,onEdit,onDelete,onUsed,onClose}) {
  const s = S[item.status] || S.good;
  const rows=[
    ["Quantity",`${item.quantity} ${item.unit}`],
    ["Category",item.category],
    ["Storage",item.storageType],
    item.purchaseDate?["Purchased",item.purchaseDate]:null,
    item.expiryDate?["Expires",item.expiryDate]:null,
    item.days!==null&&item.storageType!=="Frozen"
      ?["Days Left",item.days<0?`${Math.abs(item.days)} days ago`:item.days===0?"Today!":item.days+" days"]
      :null,
    item.notes?["Notes",item.notes]:null,
  ].filter(Boolean);

  return (
    <div className="sheet-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet">
        <div className="handle"/>

        {/* Hero */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{
            width:90,height:90,borderRadius:28,margin:"0 auto 14px",
            background:s.bg,border:`2px solid ${s.border}`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:48,boxShadow:`0 8px 24px ${s.bg}`,
          }}>{item.emoji||"📦"}</div>
          <div style={{fontSize:24,fontWeight:900,color:"#1E293B",marginBottom:8,letterSpacing:"-0.01em"}}>{item.name}</div>
          <span className="badge" style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`,fontSize:13}}>
            <span className="dot" style={{background:s.dot}}/>
            {s.label}
            {item.days!==null&&item.storageType!=="Frozen"&&(
              <span style={{marginLeft:4,opacity:0.8}}>
                {item.days<0?`· ${Math.abs(item.days)}d ago`:item.days===0?"· Today!":item.days<=7?`· ${item.days}d left`:``}
              </span>
            )}
          </span>
        </div>

        {/* Details */}
        <div className="glass-light" style={{marginBottom:20,overflow:"hidden",padding:0,borderRadius:20}}>
          {rows.map(([label,value],i)=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"14px 18px",borderBottom:i<rows.length-1?"1px solid #F1F5F9":"none"}}>
              <span style={{color:"#94A3B8",fontWeight:700,fontSize:14}}>{label}</span>
              <span style={{fontWeight:800,fontSize:14,color:"#1E293B",maxWidth:"55%",textAlign:"right"}}>{value}</span>
            </div>
          ))}
        </div>

        <button className="btn-p" onClick={onUsed} style={{marginBottom:12,background:"#166534"}}>
          ✓ Mark as Used
        </button>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-s" onClick={onEdit} style={{flex:1}}>✏️ Edit</button>
          <button className="btn-danger" onClick={()=>{if(confirm("Delete this item?"))onDelete();}} style={{flex:1}}>🗑️ Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Form ───────────────────────────────────────────────────────────────
function ItemForm({item,settings,onSave,onCancel}) {
  const today=new Date().toISOString().split("T")[0];
  const [form,setForm]=useState({name:"",emoji:"",quantity:1,unit:"pcs",category:"Pantry",storageType:"Pantry",purchaseDate:today,expiryDate:"",notes:"",...(item||{})});
  const [genning,setGenning]=useState(false);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  function estimateExpiry(){
    const days=settings.defaultExpiryByCategory[form.category]||30;
    const d=new Date();d.setDate(d.getDate()+days);
    f("expiryDate",d.toISOString().split("T")[0]);
  }

  async function genEmoji(){
    if(!form.name)return;
    const local=getEmoji(form.name,form.category);
    if(local!=="📦"){f("emoji",local);return;}
    setGenning(true);
    try{
      const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:CLAUDE_MODEL,max_tokens:20,messages:[{role:"user",content:`One emoji for "${form.name}" (${form.category}). Reply ONLY one emoji.`}]})});
      const data=await res.json();
      const t=data.content?.[0]?.text?.trim();
      if(t)f("emoji",t);
    }catch{}
    setGenning(false);
  }

  function handleSave(){
    if(!form.name.trim())return alert("Item name is required.");
    onSave({...form,emoji:form.emoji||getEmoji(form.name,form.category)});
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Emoji + Name */}
      <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
        <div style={{flexShrink:0}}>
          <span className="lbl">EMOJI</span>
          <button onClick={genEmoji} style={{
            width:60,height:60,background:"#F1F5F9",
            borderRadius:18,border:"1.5px solid #E2E8F0",
            fontSize:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            transition:"transform .1s",
          }}
            onTouchStart={e=>e.currentTarget.style.transform="scale(0.92)"}
            onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
            <span style={{animation:genning?"spin 0.8s linear infinite":""}}>{genning?"⟳":form.emoji||"📦"}</span>
          </button>
          <div style={{fontSize:10,color:"#94A3B8",textAlign:"center",marginTop:4,fontWeight:700}}>TAP</div>
        </div>
        <div style={{flex:1}}>
          <span className="lbl">ITEM NAME</span>
          <input className="inp" placeholder="e.g. Whole Milk" value={form.name} onChange={e=>{f("name",e.target.value);f("emoji","");}}/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><span className="lbl">QUANTITY</span><input className="inp" type="number" min="0" step="0.1" value={form.quantity} onChange={e=>f("quantity",parseFloat(e.target.value)||0)}/></div>
        <div><span className="lbl">UNIT</span><select className="sel" value={form.unit} onChange={e=>f("unit",e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
        <div><span className="lbl">CATEGORY</span><select className="sel" value={form.category} onChange={e=>f("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><span className="lbl">STORAGE</span><select className="sel" value={form.storageType} onChange={e=>f("storageType",e.target.value)}>{STORAGE_TYPES.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><span className="lbl">PURCHASED</span><input className="inp" type="date" value={form.purchaseDate} onChange={e=>f("purchaseDate",e.target.value)}/></div>
        <div>
          <span className="lbl">
            EXPIRES
            <button onClick={estimateExpiry} style={{background:"none",border:"none",color:"#64748B",fontSize:10,fontWeight:800,cursor:"pointer",letterSpacing:"0.04em",marginLeft:6}}>AUTO ✨</button>
          </span>
          <input className="inp" type="date" value={form.expiryDate} onChange={e=>f("expiryDate",e.target.value)}/>
        </div>
      </div>

      <div>
        <span className="lbl">NOTES (optional)</span>
        <textarea className="inp" rows={2} placeholder="Any notes…" value={form.notes} onChange={e=>f("notes",e.target.value)} style={{resize:"none"}}/>
      </div>

      <button className="btn-p" onClick={handleSave} style={{marginTop:4}}>{item?"Save Changes ✓":"Add to Pantry ✨"}</button>
      <button className="btn-s" onClick={onCancel}>Cancel</button>
    </div>
  );
}

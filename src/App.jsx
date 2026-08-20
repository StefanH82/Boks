import { useState, useEffect } from "react";

// ─── SPRINGBOKS 2026 MATCHES ──────────────────────────────────────────────────
const BOK_MATCHES = [
  {id:"T1",stage:"Test 1 · Greatest Rivalry",home:"Springboks",away:"All Blacks",kickoff:"2026-08-22T15:10:00Z",venue:"Ellis Park, Johannesburg"},
  {id:"T2",stage:"Test 2 · Greatest Rivalry",home:"Springboks",away:"All Blacks",kickoff:"2026-08-29T15:10:00Z",venue:"DHL Stadium, Cape Town"},
  {id:"T3",stage:"Test 3 · Greatest Rivalry",home:"Springboks",away:"All Blacks",kickoff:"2026-09-05T15:10:00Z",venue:"FNB Stadium, Johannesburg"},
  {id:"T4",stage:"Test 4 · Greatest Rivalry",home:"All Blacks",away:"Springboks",kickoff:"2026-09-12T22:00:00Z",venue:"M&T Bank Stadium, Baltimore"},
];

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SB_URL = "https://msqaqhavdkomvqwehqkv.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcWFxaGF2ZGtvbXZxd2VocWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4ODIxNzUsImV4cCI6MjA5NjQ1ODE3NX0.XgNKe1v9B7ua6nAJobEoqEM7i4ItmVcpmeq0GG-3hnw";

const db = {
  async q(path, opts = {}) {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: {"apikey":SB_ANON,"Authorization":`Bearer ${SB_ANON}`,"Content-Type":"application/json","Prefer":opts.prefer||"return=representation",...opts.headers},
      method: opts.method||"GET", body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) throw new Error(await res.text());
    const t = await res.text(); return t ? JSON.parse(t) : null;
  },
  async register(name, pass) {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/bok_register_user`,{
      method:"POST",headers:{"apikey":SB_ANON,"Authorization":`Bearer ${SB_ANON}`,"Content-Type":"application/json"},
      body:JSON.stringify({p_name:name,p_password:pass})
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json(); return rows?.[0]||null;
  },
  async login(name, pass) {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/bok_login_user`,{
      method:"POST",headers:{"apikey":SB_ANON,"Authorization":`Bearer ${SB_ANON}`,"Content-Type":"application/json"},
      body:JSON.stringify({p_name:name,p_password:pass})
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json(); return rows?.[0]||null;
  },
  async loadPreds(uid) {
    const rows = await db.q(`bok_predictions?user_id=eq.${uid}&select=match_id,home_score,away_score`) || [];
    const m={}; rows.forEach(r=>{m[r.match_id]={home:String(r.home_score),away:String(r.away_score)}}); return m;
  },
  async savePreds(uid, preds) {
    const rows = Object.entries(preds).filter(([,p])=>p&&p.home!==""&&p.away!=="")
      .map(([mid,p])=>({user_id:uid,match_id:mid,home_score:parseInt(p.home),away_score:parseInt(p.away)}));
    if (!rows.length) return;
    for (const mid of rows.map(r=>r.match_id)) {
      await fetch(`${SB_URL}/rest/v1/bok_predictions?user_id=eq.${uid}&match_id=eq.${mid}`,
        {method:"DELETE",headers:{"apikey":SB_ANON,"Authorization":`Bearer ${SB_ANON}`,"Content-Type":"application/json"}});
    }
    const ins = await fetch(`${SB_URL}/rest/v1/bok_predictions`,{
      method:"POST",headers:{"apikey":SB_ANON,"Authorization":`Bearer ${SB_ANON}`,"Content-Type":"application/json","Prefer":"return=minimal"},
      body:JSON.stringify(rows)
    });
    if (!ins.ok) throw new Error(await ins.text());
  },
  async loadLeaderboard() { return await db.q("bok_leaderboard?select=name,points,predictions_count")||[]; },
  async loadResults() {
    const rows = await db.q("bok_matches?select=id,home_score,away_score&home_score=not.is.null")||[];
    const m={}; rows.forEach(r=>{if(r.home_score!=null&&r.away_score!=null) m[r.id]={home:String(r.home_score),away:String(r.away_score)}}); return m;
  },
  async saveResult(id, h, a) {
    await db.q(`bok_matches?id=eq.${id}`,{method:"PATCH",prefer:"return=minimal",body:{home_score:parseInt(h),away_score:parseInt(a)}});
  },
  async removeUser(name) { await db.q(`bok_users?name=eq.${encodeURIComponent(name)}`,{method:"DELETE",prefer:"return=minimal"}); },
  async resetPassword(name, newPass) {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/bok_reset_user_password`,{
      method:"POST",headers:{"apikey":SB_ANON,"Authorization":`Bearer ${SB_ANON}`,"Content-Type":"application/json"},
      body:JSON.stringify({p_name:name,p_new_password:newPass})
    });
    if (!res.ok) throw new Error(await res.text());
  }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const SAST_TZ = "Africa/Johannesburg";
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-GB",{timeZone:SAST_TZ,month:"short",day:"numeric"}) : "";
const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString("en-GB",{timeZone:SAST_TZ,hour:"2-digit",minute:"2-digit"})+" SAST" : "";
const isLocked = iso => { if(!iso) return false; return Date.now() >= new Date(iso).getTime()-60*60*1000; };
const timeLeft = iso => {
  if(!iso) return null;
  const diff = new Date(iso).getTime()-60*60*1000-Date.now();
  if(diff<=0) return null;
  const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000);
  if(h>48) return null;
  return h>0?`${h}h ${m}m left`:`${m}m left`;
};
const getInitials = n => n.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const calcPts = (preds, results) => {
  let pts=0;
  for (const [id,pred] of Object.entries(preds)) {
    if(!pred||pred.home===""||pred.away==="") continue;
    const r=results[id]; if(!r||r.home==null||r.away==null) continue;
    const ph=parseInt(pred.home),pa=parseInt(pred.away),rh=parseInt(r.home),ra=parseInt(r.away);
    if(isNaN(ph)||isNaN(pa)||isNaN(rh)||isNaN(ra)) continue;
    if(ph===rh&&pa===ra){pts+=10;continue;}
    const pw=ph>pa?"H":ph<pa?"A":"D",rw=rh>ra?"H":rh<ra?"A":"D";
    if(pw===rw) pts+=5;
  }
  return pts;
};

const ADMIN_PIN = "boks2026SH";
const GREEN = "#007749";
const GOLD = "#FFC425";
const DARK = "#1a1f1e";
const WHITE = "#FFFFFF";
const CARD = "rgba(255,255,255,0.04)";

export default function App() {
  const [tab, setTab] = useState("predict");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [nameIn, setNameIn] = useState("");
  const [passIn, setPassIn] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [preds, setPreds] = useState({});
  const [results, setResults] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth > 1200);

  useEffect(()=>{
    const t=setInterval(()=>setTick(n=>n+1),30000); return ()=>clearInterval(t);
  },[]);
  useEffect(()=>{
    const h=()=>setIsWideScreen(window.innerWidth>1200);
    window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h);
  },[]);
  useEffect(()=>{
    db.loadResults().then(setResults).catch(()=>{});
    db.loadLeaderboard().then(lb=>setLeaderboard(lb.map(r=>({name:r.name,points:r.points||0,count:r.predictions_count||0})))).catch(()=>{});
  },[]);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3200); };

  async function handleLogin() {
    if (!nameIn.trim()) { setAuthErr("Enter your name"); return; }
    if (!passIn) { setAuthErr("Enter your password"); return; }
    setAuthLoading(true); setAuthErr("");
    try {
      const u = await db.login(nameIn.trim(), passIn);
      if (!u) { setAuthErr("Incorrect name or password"); setAuthLoading(false); return; }
      setUser(u);
      const p = await db.loadPreds(u.id);
      if (Object.keys(p).length>0) { setPreds(p); setSubmitted(true); }
    } catch(e) { setAuthErr("Login failed — try again"); }
    setAuthLoading(false);
  }
  async function handleRegister() {
    if (!nameIn.trim()||nameIn.trim().length<2) { setAuthErr("Name must be at least 2 characters"); return; }
    if (!passIn||passIn.length<6) { setAuthErr("Password must be at least 6 characters"); return; }
    if (passIn!==confirmPass) { setAuthErr("Passwords do not match"); return; }
    setAuthLoading(true); setAuthErr("");
    try {
      const u = await db.register(nameIn.trim(), passIn);
      if (!u) { setAuthErr("Name already taken — try another"); setAuthLoading(false); return; }
      setUser(u); showToast(`Welcome ${u.name}! 🟢`);
    } catch(e) { setAuthErr("Registration failed"); }
    setAuthLoading(false);
  }
  function handleLogout() {
    setUser(null); setPreds({}); setSubmitted(false);
    setNameIn(""); setPassIn(""); setConfirmPass(""); setAuthErr(""); setAuthMode("login");
  }
  function setPred(id, side, val) {
    const clean = val===""?"":String(Math.max(0,Math.min(150,parseInt(val)||0)));
    setPreds(p=>({...p,[id]:{...p[id],[side]:clean}}));
  }
  async function submitPreds() {
    if (!user) return;
    const toSave={};
    Object.entries(preds).forEach(([id,p])=>{
      if(!p||p.home===""||p.away==="") return;
      const m=BOK_MATCHES.find(x=>x.id===id);
      if(m&&isLocked(m.kickoff)) return;
      toSave[id]=p;
    });
    if (!Object.keys(toSave).length) { showToast("No unlocked predictions to save","error"); return; }
    setSaving(true);
    try {
      await db.savePreds(user.id, toSave);
      setSubmitted(true);
      const lb=await db.loadLeaderboard();
      setLeaderboard(lb.map(r=>({name:r.name,points:r.points||0,count:r.predictions_count||0})));
      showToast(`${Object.keys(toSave).length} predictions saved! 🟢`);
    } catch(e) { showToast("Save failed — check connection","error"); }
    setSaving(false);
  }

  const totalPreds = Object.values(preds).filter(p=>p&&p.home!==""&&p.away!=="").length;

  return (
    <div style={{minHeight:"100vh",background:DARK,fontFamily:"'Inter',system-ui,sans-serif",color:"#e8f0eb",position:"relative",overflowX:"hidden"}}>

      {/* Green top bar */}
      <div style={{position:"fixed",top:0,left:0,right:0,height:3,zIndex:100,background:`linear-gradient(90deg,transparent,${GREEN} 30%,${GOLD} 50%,${GREEN} 70%,transparent)`}}/>

      {/* Side images */}
      {isWideScreen && (
        <div style={{position:"fixed",left:0,top:"50%",transform:"translateY(-50%)",width:308,height:700,zIndex:5,pointerEvents:"none",overflow:"hidden"}}>
          <img src="/Left.jpg" alt="" style={{width:"100%",height:"100%",objectFit:"fill",opacity:0.85}}/>
        </div>
      )}
      {isWideScreen && (
        <div style={{position:"fixed",right:0,top:"50%",transform:"translateY(-50%)",width:308,height:700,zIndex:5,pointerEvents:"none",overflow:"hidden"}}>
          <img src="/Right.jpg" alt="" style={{width:"100%",height:"100%",objectFit:"fill",opacity:0.85}}/>
        </div>
      )}

      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:50,background:"rgba(0,119,73,0.97)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${GREEN}40`,padding:"0 20px"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0 10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:60,height:60,borderRadius:10,background:`linear-gradient(135deg,${WHITE},#ffffff)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:`0 0 20px ${GREEN}60`}}><img src="/South_Africa_national_rugby_union_team.svg" alt="Springboks" style={{width:"80%",height:"80%",objectFit:"cover"}}/></div>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:"#fff",letterSpacing:0.3,lineHeight:1.1}}>Springboks 2026</div>
                <div style={{fontSize:11,fontWeight:600, letterSpacing:3,color:GOLD,textTransform:"uppercase",marginTop:1}}>PBD Predictor</div>
              </div>
            </div>
           <div style={{display:"flex",alignItems:"center",gap:10}}>
  <div style={{width:60,height:60,borderRadius:10,background:`linear-gradient(135deg,${WHITE},#ffffff)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 20px ${GREEN}60`}}>
    <img src="/All Blacks.png" alt="All Blacks" style={{width:"80%",height:"80%",objectFit:"cover"}}/>
  </div>
  {user && (
                <>
                  <div style={{display:"flex",alignItems:"center",gap:7,background:`${GREEN}18`,border:`1px solid ${GREEN}35`,borderRadius:30,padding:"5px 12px 5px 6px"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:GREEN,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{getInitials(user.name)}</div>
                    <span style={{fontSize:12,color:"#a8d5b5",fontWeight:600}}>{user.name}</span>
                    {submitted&&<span style={{fontSize:11,color:`${GREEN}80`}}>{totalPreds}</span>}
                  </div>
                  <button onClick={handleLogout} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"5px 10px",color:"rgba(255,255,255,0.3)",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Log out</button>
                </>
              )}
            </div>
          </div>
          {/* Nav */}
          <div style={{display:"flex",gap:0,justifyContent:"center"}}>
            {[{id:"predict",label:"Predict"},{id:"leaderboard",label:"Leaderboard"},{id:"admin",label:"Admin"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"9px 20px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",
                fontSize:13,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",
                color:tab===t.id?GOLD:"rgba(255,255,255,0.3)",
                borderBottom:tab===t.id?`2px solid ${GOLD}`:"2px solid transparent",
                marginBottom:-1,transition:"all 0.15s"
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </header>

      <main style={{position:"relative",zIndex:1,maxWidth:800,margin:"0 auto",padding:"0 20px 100px"}}>

        {/* ═══ PREDICT TAB ═══ */}
        {tab==="predict" && (
          !user ? (
            <div style={{maxWidth:400,margin:"60px auto",background:`${GREEN}0a`,border:`1px solid ${GREEN}30`,borderRadius:20,padding:"40px 32px"}}>
              <div style={{textAlign:"center",marginBottom:28}}>
                <div style={{fontSize:48,marginBottom:10}}>🏉</div>
                <h2 style={{margin:"0 0 4px",fontSize:20,color:"#fff",fontWeight:800}}>Springboks 2026</h2>
                <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.35)"}}>Remaining Tests · Aug – Sep 2026</p>
              </div>
              <div style={{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:10,padding:4,marginBottom:20}}>
                {["login","register"].map(m=>(
                  <button key={m} onClick={()=>{setAuthMode(m);setAuthErr("");}} style={{
                    flex:1,padding:"8px 0",border:"none",borderRadius:8,
                    background:authMode===m?`${GREEN}70`:"transparent",
                    color:authMode===m?"#fff":"rgba(255,255,255,0.35)",
                    fontWeight:authMode===m?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"
                  }}>{m==="login"?"Log In":"Register"}</button>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {["Your name","Password",...(authMode==="register"?["Confirm password"]:[])].map((ph,i)=>(
                  <input key={i} type={i===0?"text":"password"}
                    value={i===0?nameIn:i===1?passIn:confirmPass}
                    onChange={e=>{setAuthErr("");[setNameIn,setPassIn,setConfirmPass][i](e.target.value);}}
                    onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?handleLogin():handleRegister())}
                    placeholder={i===1&&authMode==="register"?"Create password (min 6 chars)":ph}
                    style={{padding:"11px 14px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,color:"#fff",fontSize:13,fontFamily:"inherit",outline:"none"}}
                  />
                ))}
              </div>
              {authErr&&<div style={{marginTop:10,padding:"9px 12px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:7,fontSize:12,color:"#f87171"}}>{authErr}</div>}
              <button onClick={authMode==="login"?handleLogin:handleRegister} disabled={authLoading} style={{
                width:"100%",marginTop:14,padding:"12px",
                background:authLoading?"rgba(45,138,78,0.3)":`linear-gradient(135deg,${GREEN},#1a5c34)`,
                border:"none",borderRadius:9,color:authLoading?"rgba(255,255,255,0.4)":"#fff",
                fontWeight:700,fontSize:13,cursor:authLoading?"not-allowed":"pointer",fontFamily:"inherit",
                boxShadow:`0 4px 14px ${GREEN}40`
              }}>{authLoading?(authMode==="login"?"Logging in…":"Creating account…"):(authMode==="login"?"Log In":"Create Account")}</button>
              <p style={{textAlign:"center",marginTop:14,fontSize:12,color:"rgba(255,255,255,0.2)"}}>
                {authMode==="login"
                  ?<>No account? <span onClick={()=>{setAuthMode("register");setAuthErr("");}} style={{color:"#a8d5b5",cursor:"pointer",textDecoration:"underline"}}>Register</span></>
                  :<>Have an account? <span onClick={()=>{setAuthMode("login");setAuthErr("");}} style={{color:"#a8d5b5",cursor:"pointer",textDecoration:"underline"}}>Log in</span></>}
              </p>
              <div style={{marginTop:16,padding:"8px 12px",background:`${GREEN}08`,border:`1px solid ${GREEN}18`,borderRadius:7,fontSize:10,color:"rgba(255,255,255,0.25)",textAlign:"center"}}>
                ⏱ Predictions lock 1 hour before kick-off · All times SAST
              </div>
            </div>
          ) : (
            <>
              {submitted&&(
                <div style={{margin:"16px 0 0",background:`${GREEN}0a`,border:`1px solid ${GREEN}25`,borderRadius:9,padding:"9px 14px",display:"flex",alignItems:"center",gap:8,fontSize:12,color:`${GREEN}cc`}}>
                  <span>✓</span>
                  <span>{totalPreds} predictions saved · {calcPts(preds,results)} pts so far</span>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:16}}>
                {BOK_MATCHES.map(match=>{
                  const pred=preds[match.id]||{home:"",away:""};
                  const result=results[match.id];
                  const locked=isLocked(match.kickoff);
                  const hasPred=pred&&pred.home!==""&&pred.away!=="";
                  const hasResult=result!=null&&result.home!=null&&result.away!=null&&result.home!==""&&result.away!=="";
                  const deadline=timeLeft(match.kickoff);
                  let ptsBadge=null;
                  if(hasResult&&hasPred){
                    const ph=parseInt(pred.home),pa=parseInt(pred.away),rh=parseInt(result.home),ra=parseInt(result.away);
                    if(!isNaN(ph)&&!isNaN(pa)){
                      if(ph===rh&&pa===ra) ptsBadge={v:"+10",c:"#4ade80",b:"rgba(74,222,128,0.12)"};
                      else{const pw=ph>pa?"H":ph<pa?"A":"D",rw=rh>ra?"H":rh<ra?"A":"D";
                        ptsBadge=pw===rw?{v:"+5",c:"#60a5fa",b:"rgba(96,165,250,0.12)"}:{v:"0",c:"rgba(255,255,255,0.25)",b:"rgba(255,255,255,0.04)"};}
                    }
                  }
                  return (
                    <div key={match.id} style={{
                      background:locked?(hasResult?"rgba(255,255,255,0.02)":`${GOLD}06`):hasPred?`${GREEN}08`:"rgba(255,255,255,0.02)",
                      border:`1px solid ${locked&&hasResult?"rgba(255,255,255,0.05)":locked?`${GOLD}25`:hasPred?`${GREEN}25`:"rgba(255,255,255,0.06)"}`,
                      borderRadius:10,padding:"10px 12px",opacity:locked&&!hasResult?0.65:1
                    }}>
                      {/* Stage label */}
                      <div style={{fontSize:13,color:`${GREEN}90`,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{match.stage}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {/* Time col */}
                        <div style={{minWidth:64,textAlign:"center",flexShrink:0}}>
                          {hasResult?(
                            <div style={{fontSize:13,color:"rgba(255,255,255,0.3)",fontWeight:600}}>FT</div>
                          ):locked?(
                            <div style={{fontSize:13,color:GOLD}}>🔒</div>
                          ):deadline?(
                            <div style={{fontSize:13,color:GOLD,fontWeight:700}}>{deadline}</div>
                          ):match.kickoff?(
                            <div style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>
                              {fmtDate(match.kickoff)}<br/>{fmtTime(match.kickoff)}
                            </div>
                          ):<div style={{fontSize:13,color:"rgba(255,255,255,0.2)"}}>TBD</div>}
                          {ptsBadge&&<div style={{marginTop:3,fontSize:10,fontWeight:800,color:ptsBadge.c,background:ptsBadge.b,borderRadius:4,padding:"1px 5px",display:"inline-block"}}>{ptsBadge.v}</div>}
                        </div>
                        {/* Home */}
                        <span style={{flex:1,fontSize:13,textAlign:"right",color:locked?"rgba(255,255,255,0.35)":"#e8f0eb",fontWeight:600}}>{match.home}</span>
                        {/* Inputs */}
                        <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                          <input type="number" min={0} max={150} value={pred.home}
                            onChange={e=>{if(!locked)setPred(match.id,"home",e.target.value);}}
                            onKeyDown={e=>{if(locked)e.preventDefault();}}
                            placeholder="-"
                            style={{width:36,height:34,textAlign:"center",
                              background:locked?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.07)",
                              border:`1px solid ${locked?"rgba(255,255,255,0.06)":`${GREEN}40`}`,
                              borderRadius:7,color:locked?"rgba(255,255,255,0.25)":"#fff",
                              fontSize:15,fontWeight:800,fontFamily:"inherit",outline:"none",
                              cursor:locked?"not-allowed":"text",pointerEvents:locked?"none":"auto"}}
                          />
                          <span style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>–</span>
                          <input type="number" min={0} max={150} value={pred.away}
                            onChange={e=>{if(!locked)setPred(match.id,"away",e.target.value);}}
                            onKeyDown={e=>{if(locked)e.preventDefault();}}
                            placeholder="-"
                            style={{width:36,height:34,textAlign:"center",
                              background:locked?"rgba(255,255,255,0.03)":"rgba(255,255,255,0.07)",
                              border:`1px solid ${locked?"rgba(255,255,255,0.06)":`${GREEN}40`}`,
                              borderRadius:7,color:locked?"rgba(255,255,255,0.25)":"#fff",
                              fontSize:15,fontWeight:800,fontFamily:"inherit",outline:"none",
                              cursor:locked?"not-allowed":"text",pointerEvents:locked?"none":"auto"}}
                          />
                        </div>
                        {/* Away */}
                        <span style={{flex:1,fontSize:13,color:locked?"rgba(255,255,255,0.35)":"#e8f0eb",fontWeight:600}}>{match.away}</span>
                        {/* Result */}
                        {hasResult&&(
                          <div style={{fontSize:13,fontWeight:800,minWidth:42,textAlign:"center",background:`${GREEN}12`,border:`1px solid ${GREEN}30`,borderRadius:7,padding:"3px 7px",color:"#4ade80",flexShrink:0}}>{result.home}–{result.away}</div>
                        )}
                        {locked&&!hasResult&&(
                          <div style={{fontSize:10,color:`${GOLD}60`,minWidth:42,textAlign:"center",flexShrink:0}}>Pending</div>
                        )}
                      </div>
                      {/* Venue */}
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",marginTop:6}}>📍 {match.venue}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:20,display:"flex",justifyContent:"center",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <button onClick={submitPreds} disabled={saving} style={{
                  padding:"13px 44px",
                  background:saving?`${GREEN}30`:`linear-gradient(135deg,${GREEN},#1a5c34)`,
                  border:"none",borderRadius:50,color:saving?"rgba(255,255,255,0.4)":"#fff",
                  fontWeight:800,fontSize:13,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",
                  boxShadow:`0 4px 20px ${GREEN}50`
                }}>{saving?"Saving…":submitted?"Update Predictions":"Submit Predictions"}</button>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.2)"}}>{totalPreds} / {BOK_MATCHES.length} filled</span>
              </div>
              <p style={{textAlign:"center",marginTop:8,fontSize:10,color:"rgba(255,255,255,0.15)"}}>
                +10 exact score · +5 correct result · Locks 1hr before kick-off · All times SAST
              </p>
            </>
          )
        )}

        {/* ═══ LEADERBOARD TAB ═══ */}
        {tab==="leaderboard" && (
          <div style={{paddingTop:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h2 style={{margin:0,fontSize:16,color:"#fff"}}>Rankings</h2>
              <button onClick={async()=>{
                const lb=await db.loadLeaderboard().catch(()=>[]);
                setLeaderboard(lb.map(r=>({name:r.name,points:r.points||0,count:r.predictions_count||0})));
              }} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"5px 12px",color:"rgba(255,255,255,0.3)",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>↻ Refresh</button>
            </div>
            <div style={{display:"flex",gap:16,padding:"9px 14px",marginBottom:12,background:"rgba(255,255,255,0.025)",borderRadius:8,flexWrap:"wrap"}}>
              {[{pts:"+10",label:"Exact score",c:GREEN},{pts:"+5",label:"Correct result",c:"#60a5fa"},{pts:"90",label:"Max pts",c:"rgba(255,255,255,0.4)"}].map(({pts,label,c})=>(
                <span key={label} style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>
                  <span style={{color:c,fontWeight:700}}>{pts}</span> {label}
                </span>
              ))}
            </div>
            {leaderboard.length===0?(
              <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,0.2)",fontSize:12}}>No predictions yet — be the first!</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {leaderboard.map((entry,i)=>{
                  const isMe=user&&entry.name.toLowerCase()===user.name.toLowerCase();
                  const medals=["🥇","🥈","🥉"];
                  const maxPts=leaderboard[0]?.points||1;
                  const pct=Math.max(4,Math.round((entry.points/maxPts)*100));
                  return (
                    <div key={entry.name} style={{position:"relative",overflow:"hidden",background:isMe?`${GREEN}10`:"rgba(255,255,255,0.025)",border:isMe?`1px solid ${GREEN}30`:"1px solid rgba(255,255,255,0.055)",borderRadius:10,padding:"12px 16px"}}>
                      <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${pct}%`,background:isMe?`${GREEN}10`:i===0?`${GREEN}08`:"rgba(255,255,255,0.015)",transition:"width 0.6s ease"}}/>
                      <div style={{position:"relative",display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontSize:i<3?18:12,minWidth:26,textAlign:"center",color:i>=3?"rgba(255,255,255,0.2)":undefined}}>{i<3?medals[i]:i+1}</span>
                        <div style={{width:30,height:30,borderRadius:"50%",flexShrink:0,background:isMe?GREEN:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:isMe?"#fff":"rgba(255,255,255,0.35)"}}>{getInitials(entry.name)}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,color:isMe?"#a8d5b5":"#e8f0eb",fontWeight:isMe?700:400}}>
                            {entry.name}{isMe&&<span style={{fontSize:11,opacity:0.4}}> (you)</span>}
                          </div>
                          {entry.count&&<div style={{fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:1}}>{entry.count} predictions</div>}
                        </div>
                        <div>
                          <span style={{fontSize:22,fontWeight:700,color:i===0?"#a8d5b5":i<3?"#e8f0eb":"rgba(255,255,255,0.35)"}}>{entry.points}</span>
                          <span style={{fontSize:11,color:"rgba(255,255,255,0.2)",marginLeft:3}}>pts</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ ADMIN TAB ═══ */}
        {tab==="admin" && (
          <div style={{paddingTop:20}}>
            {!adminUnlocked?(
              <div style={{maxWidth:320,margin:"40px auto",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"40px 24px",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:12}}>🔐</div>
                <h2 style={{margin:"0 0 8px",fontSize:16,color:"#fff"}}>Admin Panel</h2>
                <input type="password" placeholder="Enter PIN" value={adminPin} onChange={e=>setAdminPin(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){if(adminPin===ADMIN_PIN)setAdminUnlocked(true);else showToast("Wrong PIN","error");}}}
                  style={{width:"100%",padding:"10px 14px",boxSizing:"border-box",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:"#fff",fontSize:14,fontFamily:"inherit",outline:"none",marginBottom:10}}
                />
                <button onClick={()=>{if(adminPin===ADMIN_PIN)setAdminUnlocked(true);else showToast("Wrong PIN","error");}} style={{padding:"10px 28px",background:`linear-gradient(135deg,${GREEN},#1a5c34)`,border:"none",borderRadius:8,color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Unlock</button>
              </div>
            ):(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <h2 style={{margin:0,fontSize:16,color:"#fff"}}>Admin Panel</h2>
                  <span style={{fontSize:10,color:"#4ade80",background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:20,padding:"3px 10px"}}>● Admin</span>
                </div>
                {/* Manual results */}
                <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:0.5,marginBottom:8}}>Enter Match Results</div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {BOK_MATCHES.map(match=>{
                    const r=results[match.id]||{home:"",away:""};
                    const saved=results[match.id];
                    const draft=results[`draft_${match.id}`]||saved||{home:"",away:""};
                    const isDirty=draft.home!==r.home||draft.away!==r.away;
                    const isSaved=r.home!==""&&r.away!=="";
                    const setDraft=(side,val)=>setResults(prev=>({...prev,[`draft_${match.id}`]:{...(prev[`draft_${match.id}`]||prev[match.id]||{home:"",away:""}),  [side]:val}}));
                    const saveThis=async()=>{
                      const h=draft.home,a=draft.away;
                      if(h===""||a===""){showToast("Enter both scores","error");return;}
                      try{
                        await db.saveResult(match.id,h,a);
                        setResults(prev=>{const n={...prev};n[match.id]={home:h,away:a};delete n[`draft_${match.id}`];return n;});
                        showToast(`${match.home} ${h}–${a} ${match.away} saved`);
                        const lb=await db.loadLeaderboard();
                        setLeaderboard(lb.map(r=>({name:r.name,points:r.points||0,count:r.predictions_count||0})));
                      }catch{showToast("Save failed","error");}
                    };
                    return (
                      <div key={match.id} style={{background:isSaved?`${GREEN}06`:"rgba(255,255,255,0.025)",border:`1px solid ${isSaved?`${GREEN}20`:"rgba(255,255,255,0.06)"}`,borderRadius:9,padding:"9px 12px",display:"flex",alignItems:"center",gap:8}}>
                        <div style={{minWidth:52,textAlign:"center"}}>
                          {match.kickoff&&<div style={{fontSize:8,color:"rgba(255,255,255,0.2)"}}>{fmtDate(match.kickoff)}<br/>{fmtTime(match.kickoff)}</div>}
                          {isSaved&&!isDirty&&<div style={{fontSize:8,color:"#4ade80",marginTop:2}}>✓</div>}
                          {isDirty&&<div style={{fontSize:8,color:GOLD,marginTop:2}}>●</div>}
                        </div>
                        <span style={{flex:1,fontSize:11,textAlign:"right",color:"#e8f0eb"}}>{match.home}</span>
                        <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                          <input type="number" min={0} max={150} value={draft.home} onChange={e=>setDraft("home",e.target.value)} placeholder="-"
                            style={{width:36,height:30,textAlign:"center",background:`${GREEN}0a`,border:`1px solid ${isDirty?`${GOLD}50`:`${GREEN}30`}`,borderRadius:5,color:"#4ade80",fontSize:14,fontWeight:700,fontFamily:"inherit",outline:"none"}}/>
                          <span style={{color:"rgba(255,255,255,0.18)",fontSize:10}}>–</span>
                          <input type="number" min={0} max={150} value={draft.away} onChange={e=>setDraft("away",e.target.value)} placeholder="-"
                            style={{width:36,height:30,textAlign:"center",background:`${GREEN}0a`,border:`1px solid ${isDirty?`${GOLD}50`:`${GREEN}30`}`,borderRadius:5,color:"#4ade80",fontSize:14,fontWeight:700,fontFamily:"inherit",outline:"none"}}/>
                        </div>
                        <span style={{flex:1,fontSize:11,color:"#e8f0eb"}}>{match.away}</span>
                        <button onClick={saveThis} style={{padding:"4px 10px",flexShrink:0,background:isDirty?`linear-gradient(135deg,${GREEN},#1a5c34)`:`${GREEN}0a`,border:`1px solid ${isDirty?GREEN:`${GREEN}20`}`,borderRadius:6,color:isDirty?"#fff":`${GREEN}60`,fontSize:10,fontWeight:700,cursor:isDirty?"pointer":"default",fontFamily:"inherit"}}>
                          {isSaved&&!isDirty?"✓":"Save"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* Manage players */}
                {leaderboard.length>0&&(
                  <div style={{marginTop:20,background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:14,padding:"16px 20px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#f87171",marginBottom:10}}>👥 Manage Players</div>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {leaderboard.map(entry=>(
                        <div key={entry.name} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"7px 12px"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,color:"#e8f0eb"}}>{entry.name}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>{entry.points} pts</div>
                          </div>
                          <button onClick={async()=>{
                            const p=window.prompt(`Reset password for ${entry.name}:`);
                            if(!p) return;
                            if(p.length<6){showToast("Min 6 characters","error");return;}
                            try{await db.resetPassword(entry.name,p);showToast(`Password reset for ${entry.name}`);}
                            catch{showToast("Reset failed","error");}
                          }} style={{padding:"4px 9px",background:`${GREEN}12`,border:`1px solid ${GREEN}25`,borderRadius:6,color:"#a8d5b5",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginRight:4}}>🔑</button>
                          <button onClick={async()=>{
                            if(!window.confirm(`Remove ${entry.name}?`)) return;
                            try{await db.removeUser(entry.name);setLeaderboard(lb=>lb.filter(e=>e.name!==entry.name));showToast(`${entry.name} removed`);}
                            catch{showToast("Failed","error");}
                          }} style={{padding:"4px 9px",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:6,color:"#f87171",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}   
        
      </main>

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"rgba(120,20,20,0.97)":"rgba(10,40,20,0.97)",border:`1px solid ${toast.type==="error"?"#f87171":"#4ade80"}`,borderRadius:10,padding:"11px 22px",color:"#fff",fontSize:12,fontWeight:600,zIndex:200,whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
          {toast.type==="error"?"✗ ":"✓ "}{toast.msg}
        </div>
      )}

      <style>{`
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}
        *{box-sizing:border-box}
      `}</style>
        {/* Sticky Footer */}
<div style={{
  position:"fixed",bottom:0,left:0,right:0,zIndex:50,
  background:"rgba(0,0,0,0.95)",
  borderTop:"none",
  borderImage:`linear-gradient(90deg,transparent,${GREEN} 30%,${GOLD} 50%,${GREEN} 70%,transparent) 1`,
  borderTopWidth:"3px",
  borderTopStyle:"solid",
  backdropFilter:"blur(10px)",
  padding:"10px 20px",
  display:"flex",alignItems:"center",justifyContent:"center",gap:20
}}>
  <span style={{fontSize:13,color:`${GOLD}`,letterSpacing:2,textTransform:"uppercase"}}>Springboks 2026</span>
  <span style={{fontSize:13,color:"rgba(255,255,255,0.15)"}}>·</span>
  <span style={{fontSize:13,color:"rgba(255,255,255)"}}>+10 exact score · +5 correct result · All times SAST</span>
  <span style={{fontSize:13,color:"rgba(255,255,255,0.15)"}}>·</span>
  <span style={{fontSize:13,color:`${GOLD}`,letterSpacing:2,textTransform:"uppercase"}}>PBD Predictor</span>
</div>
    </div>
  );
}

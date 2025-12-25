
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Prize, RaceStatus } from './types';
import { PRIZE_CONFIG, COLORS } from './constants';
import Wheel from './components/Wheel';
import { getRaceCommentary } from './services/geminiService';
import { soundService } from './services/soundService';

type ThemeType = 'dark' | 'light' | 'custom';

interface PrizeConfigTemplate {
  id: number;
  name: string;
  image: string;
  color: string;
  type: 'food' | 'tech' | 'money';
  description: string;
  count: number;
}

const App: React.FC = () => {
  const [status, setStatus] = useState<RaceStatus>('idle');
  const [rotation, setRotation] = useState(0);
  const [theme, setTheme] = useState<ThemeType>('dark');
  const [customBgBase64, setCustomBgBase64] = useState<string | null>(null);
  const [congratsTemplate, setCongratsTemplate] = useState('Xin chúc mừng {name} đã cực kỳ may mắn nhận được {prize}! Chúc bạn một ngày tuyệt vời!');
  const [useAI, setUseAI] = useState(true); // Tính năng mới: Bật/Tắt AI
  const [userAudioBase64, setUserAudioBase64] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(8); 
  const [spinnerName, setSpinnerName] = useState('');
  
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [effectVolume, setEffectVolume] = useState(0.5);
  const [prizeConfigs, setPrizeConfigs] = useState<PrizeConfigTemplate[]>(PRIZE_CONFIG.map((c, i) => ({ ...c, id: Date.now() + i })));
  const [currentPrizes, setCurrentPrizes] = useState<Prize[]>([]);
  const [winner, setWinner] = useState<Prize | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [commentary, setCommentary] = useState<string>('');
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  
  const rotationRef = useRef(0);
  const lastTickAngle = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const currentEditingId = useRef<number | null>(null);
  
  const currentSpinNameRef = useRef<string>('');

  useEffect(() => {
    const initial: Prize[] = [];
    prizeConfigs.forEach((config, idx) => {
      for (let i = 0; i < config.count; i++) {
        initial.push({
          id: `prize-${config.id}-${i}-${Date.now()}`,
          name: config.name,
          image: config.image,
          color: COLORS[idx % COLORS.length],
          type: config.type,
          description: config.description
        });
      }
    });
    setCurrentPrizes(initial.sort(() => Math.random() - 0.5));
  }, [prizeConfigs]);

  useEffect(() => {
    soundService.setVolumes(musicVolume, effectVolume);
  }, [musicVolume, effectVolume]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserAudioBase64(reader.result as string);
        soundService.initContext();
        showToast(`Đã tải nhạc nền: ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
  };

  const spin = () => {
    if (status === 'spinning' || currentPrizes.length === 0) return;
    const nameToSpin = spinnerName.trim();
    if (!nameToSpin) { showToast("Vui lòng nhập tên người quay!", 'error'); return; }

    soundService.initContext();
    setStatus('spinning');
    setWinner(null);
    setShowPopup(false);
    setCommentary(''); // QUAN TRỌNG: Xóa lời chúc cũ ngay lập tức
    
    currentSpinNameRef.current = nameToSpin;
    toggleMusic(true);

    const extraSpins = 12 + Math.random() * 5;
    const finalRotation = rotationRef.current + (extraSpins * 360) + Math.random() * 360;
    const duration = 8000;
    const startTime = performance.now();
    const startRotation = rotationRef.current;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      const currentRotation = startRotation + (finalRotation - startRotation) * ease;
      rotationRef.current = currentRotation;
      setRotation(currentRotation);

      const sliceSize = 360 / currentPrizes.length;
      if (Math.floor(currentRotation / sliceSize) > Math.floor(lastTickAngle.current / sliceSize)) {
        soundService.playGallop();
        lastTickAngle.current = currentRotation;
      }
      if (progress < 1) requestAnimationFrame(animate);
      else finishSpin(currentRotation, nameToSpin);
    };
    requestAnimationFrame(animate);
    setSpinnerName(''); 
  };

  const toggleMusic = (play: boolean) => {
    if (muted || !userAudioBase64) return;
    play ? soundService.playUserMusic(userAudioBase64, audioDuration) : soundService.stopUserMusic();
  };

  const finishSpin = (finalRotation: number, fixedName: string) => {
    setStatus('finished');
    toggleMusic(false); 
    soundService.playWin();
    
    const normalizedRotation = (finalRotation % 360);
    const sliceSize = 360 / currentPrizes.length;
    const pointerAngle = (270 - normalizedRotation + 360) % 360;
    const winnerIndex = Math.floor(pointerAngle / sliceSize);
    const winPrize = currentPrizes[winnerIndex];
    
    setWinner(winPrize);
    
    // Tạo lời chúc từ mẫu trước
    const instantMsg = congratsTemplate
      .replace(/{name}/g, fixedName)
      .replace(/{prize}/g, winPrize.name);
    
    setCommentary(instantMsg);
    setShowPopup(true);
    setCurrentPrizes(prev => prev.filter(p => p.id !== winPrize.id));
    
    // Nếu dùng AI thì mới gọi AI
    if (useAI) {
      handleCommentaryAI(winPrize, fixedName);
    }
  };

  const handleCommentaryAI = async (prize: Prize, name: string) => {
    setLoadingCommentary(true);
    const comm = await getRaceCommentary(prize.name, currentPrizes.map(p => p.name), name);
    if (comm) setCommentary(comm);
    setLoadingCommentary(false);
  };

  const remainingInventory = useMemo(() => {
    const inv: Record<string, { count: number, image: string, color: string }> = {};
    currentPrizes.forEach(p => {
      if (!inv[p.name]) inv[p.name] = { count: 0, image: p.image, color: p.color };
      inv[p.name].count++;
    });
    return Object.entries(inv).sort((a, b) => b[1].count - a[1].count);
  }, [currentPrizes]);

  return (
    <div 
      style={theme === 'custom' && customBgBase64 ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${customBgBase64})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: theme === 'light' ? '#f8fafc' : '#020617' }}
      className={`min-h-screen flex flex-col items-center p-4 md:p-8 transition-all duration-700 overflow-x-hidden relative ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}
    >
      {/* Thông báo (Toasts) */}
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-300 w-[90%] max-w-md ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'} text-xl`}></i>
          <span className="font-black text-sm uppercase tracking-wide truncate">{toast.msg}</span>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && currentEditingId.current !== null) {
          const reader = new FileReader();
          reader.onloadend = () => setPrizeConfigs(prev => prev.map(p => p.id === currentEditingId.current ? { ...p, image: reader.result as string } : p));
          reader.readAsDataURL(file);
        }
      }} accept="image/*" className="hidden" />
      <input type="file" ref={audioInputRef} onChange={handleAudioUpload} accept="audio/*" className="hidden" />
      <input type="file" ref={bgInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => { setCustomBgBase64(reader.result as string); setTheme('custom'); };
          reader.readAsDataURL(file);
        }
      }} accept="image/*" className="hidden" />

      {/* Điều khiển hệ thống */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-[250] flex gap-3">
        <button onClick={() => setShowInventory(!showInventory)} className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-xl flex items-center justify-center lg:hidden hover:bg-white/10 transition-all"><i className="fas fa-gift text-pink-500 text-xl"></i></button>
        <button onClick={() => setShowSettings(true)} className="group relative w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-yellow-500 text-slate-950 shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center border-2 border-white/40">
          <i className="fas fa-cog text-xl md:text-3xl animate-spin-slow"></i>
        </button>
        <button onClick={() => { setMuted(!muted); soundService.setMute(!muted); }} className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-xl flex items-center justify-center hover:bg-white/10 transition-all"><i className={`fas ${muted ? 'fa-volume-mute text-red-500' : 'fa-volume-up text-green-500'} text-xl`}></i></button>
      </div>

      {/* Bảng Cài đặt Chi tiết */}
      <div className={`fixed inset-y-0 left-0 w-full sm:w-[450px] z-[300] bg-slate-950 border-r border-yellow-500/30 p-6 md:p-8 transform transition-transform duration-500 overflow-y-auto custom-scrollbar ${showSettings ? 'translate-x-0 shadow-[0_0_100px_rgba(0,0,0,0.8)]' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Cấu hình</h2>
          <button onClick={() => setShowSettings(false)} className="bg-red-500/10 text-red-500 w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
        </div>

        <div className="space-y-10">
          {/* LỜI CHÚC & AI */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest italic flex items-center gap-2"><i className="fas fa-comment-dots"></i> CÀI ĐẶT LỜI CHÚC</h3>
            <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-5">
               <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-300 uppercase">Sử dụng bình luận AI</span>
                  <button 
                    onClick={() => setUseAI(!useAI)}
                    className={`w-12 h-6 rounded-full transition-all relative ${useAI ? 'bg-green-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${useAI ? 'left-7' : 'left-1'}`}></div>
                  </button>
               </div>
               
               <div className="space-y-2">
                 <span className="text-[10px] text-slate-400 font-bold italic block">Mẫu lời chúc mặc định:</span>
                 <textarea 
                    value={congratsTemplate}
                    onChange={(e) => setCongratsTemplate(e.target.value)}
                    className="w-full h-24 bg-slate-900 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-yellow-500 transition-all resize-none"
                    placeholder="Dùng {name} cho tên, {prize} cho quà..."
                 />
                 <p className="text-[9px] text-slate-500 italic leading-relaxed">AI sẽ dựa trên phong cách của bạn để tạo ra những lời bình luận sôi nổi hơn.</p>
               </div>
            </div>
          </section>

          {/* ÂM THANH */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest italic flex items-center gap-2"><i className="fas fa-music"></i> ÂM THANH</h3>
            <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-6">
              <button onClick={() => audioInputRef.current?.click()} className="w-full py-4 rounded-xl border-2 border-dashed border-white/20 bg-white/5 text-[10px] font-black uppercase flex items-center justify-center gap-3 hover:border-yellow-500/50 hover:text-yellow-500 transition-all">
                <i className="fas fa-upload"></i> {userAudioBase64 ? "ĐÃ TẢI NHẠC RIÊNG" : "TẢI NHẠC NỀN (MP3)"}
              </button>
              
              <div className="space-y-3">
                 <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                    <span>Âm lượng nhạc nền:</span>
                    <span className="text-yellow-500">{Math.round(musicVolume * 100)}%</span>
                 </div>
                 <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                    <span>Âm lượng hiệu ứng:</span>
                    <span className="text-blue-500">{Math.round(effectVolume * 100)}%</span>
                 </div>
                 <input type="range" min="0" max="1" step="0.01" value={effectVolume} onChange={(e) => setEffectVolume(parseFloat(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
              </div>

              <div className="space-y-3 pt-2 border-t border-white/5">
                 <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                    <span>Thời lượng phát:</span>
                    <span className="text-yellow-500">{audioDuration} GIÂY</span>
                 </div>
                 <input type="range" min="3" max="30" step="1" value={audioDuration} onChange={(e) => setAudioDuration(parseInt(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </section>

          {/* GIAO DIỆN */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest italic flex items-center gap-2"><i className="fas fa-palette"></i> GIAO DIỆN</h3>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
               <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative group border border-white/10">
                 {customBgBase64 ? <img src={customBgBase64} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-600 text-[10px] font-black uppercase">Chưa chọn nền</div>}
                 <button onClick={() => bgInputRef.current?.click()} className="absolute inset-0 bg-yellow-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-slate-950 font-black text-xs uppercase transition-opacity">THAY NỀN</button>
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => {setTheme('dark'); setCustomBgBase64(null);}} className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${theme === 'dark' && !customBgBase64 ? 'border-yellow-500 text-yellow-500' : 'border-white/5 text-slate-500'}`}>Tối</button>
                 <button onClick={() => {setTheme('light'); setCustomBgBase64(null);}} className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${theme === 'light' ? 'border-blue-500 text-blue-500' : 'border-white/5 text-slate-500'}`}>Sáng</button>
               </div>
            </div>
          </section>

          {/* DANH SÁCH QUÀ */}
          <section className="space-y-4 pb-10">
             <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest italic flex items-center gap-2"><i className="fas fa-gift"></i> DANH SÁCH QUÀ</h3>
                <button onClick={() => setPrizeConfigs([...prizeConfigs, { id: Date.now(), name: 'Quà mới', image: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', color: COLORS[prizeConfigs.length % COLORS.length], type: 'food', description: '', count: 1 }])} className="bg-yellow-500 text-slate-950 px-3 py-1 rounded-lg text-[10px] font-black shadow-lg">+ THÊM</button>
             </div>
             <div className="space-y-3">
               {prizeConfigs.map(config => (
                 <div key={config.id} className="bg-white/5 p-4 rounded-2xl flex gap-4 items-center group border border-white/5 hover:border-yellow-500/30 transition-all">
                    <div className="relative w-12 h-12 min-w-[48px] rounded-xl overflow-hidden bg-black/40 border border-white/10">
                       <img src={config.image} className="w-full h-full object-contain p-1" />
                       <div onClick={() => { currentEditingId.current = config.id; fileInputRef.current?.click(); }} className="absolute inset-0 bg-yellow-500/90 text-slate-950 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                          <i className="fas fa-camera text-[10px]"></i>
                       </div>
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                       <input type="text" value={config.name} onChange={(e) => setPrizeConfigs(prizeConfigs.map(c => c.id === config.id ? { ...c, name: e.target.value } : c))} className="w-full bg-slate-800 border-none rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none focus:ring-1 ring-yellow-500/50" />
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-500 font-black">SL:</span>
                          <input type="number" value={config.count} onChange={(e) => setPrizeConfigs(prizeConfigs.map(c => c.id === config.id ? { ...c, count: parseInt(e.target.value) || 0 } : c))} className="w-12 bg-slate-800 border-none rounded-lg px-2 py-0.5 text-[10px] text-yellow-500 font-black outline-none" />
                          <button onClick={() => setPrizeConfigs(prizeConfigs.filter(c => c.id !== config.id))} className="ml-auto text-red-500/30 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt text-[10px]"></i></button>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
          </section>
        </div>
      </div>

      {/* Kho quà bên phải */}
      <div className={`fixed inset-y-0 right-0 z-[150] bg-slate-950/95 backdrop-blur-3xl border-l border-white/10 p-6 flex flex-col pt-24 transition-transform duration-500 
        ${showInventory ? 'translate-x-0 w-[300px]' : 'translate-x-full lg:translate-x-0 lg:w-72 xl:w-80'}`}
      >
        <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-6 italic opacity-70">DANH SÁCH QUÀ TRONG VÒNG</h3>
        <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {remainingInventory.map(([name, data]) => (
            <div key={name} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
              <img src={data.image} className="w-10 h-10 object-contain" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-black text-white block truncate uppercase">{name}</span>
                <span className="text-[10px] text-yellow-500 font-black italic">{data.count} CÒN LẠI</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bố cục chính */}
      <div className="flex flex-col items-center w-full max-w-6xl transition-all duration-500 lg:pr-72 xl:pr-80 pt-16 md:pt-32">
        <div className="relative w-full flex flex-col items-center gap-10 mb-20 px-4">
          <div className="w-full max-w-[95vw] sm:max-w-[450px] md:max-w-[550px] lg:max-w-[650px] aspect-square flex items-center justify-center relative">
            <div className="absolute inset-0 bg-yellow-500/5 blur-[100px] rounded-full -z-10 animate-pulse"></div>
            <Wheel prizes={currentPrizes} rotation={rotation} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 md:w-20 md:h-20 bg-slate-950 rounded-full border-4 border-yellow-500 flex items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.5)] z-20">
              <i className="fas fa-horse-head text-yellow-500 text-3xl md:text-4xl"></i>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-6 relative z-10">
            <input 
              type="text" 
              value={spinnerName}
              onChange={(e) => setSpinnerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && spin()}
              placeholder="TÊN NGƯỜI QUAY..."
              className="w-full bg-slate-900/95 border-2 border-white/10 rounded-2xl px-6 py-5 text-center text-lg md:text-xl font-black text-yellow-500 outline-none focus:border-yellow-500 uppercase italic placeholder:text-slate-700 transition-all shadow-inner"
              disabled={status === 'spinning'}
            />
            <button 
              onClick={spin}
              disabled={status === 'spinning' || currentPrizes.length === 0}
              className={`w-full py-6 md:py-8 rounded-3xl font-black text-2xl md:text-3xl lg:text-4xl transition-all shadow-2xl relative overflow-hidden group ${status === 'spinning' ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-b from-yellow-400 to-orange-600 text-slate-950 hover:scale-[1.03] active:scale-95 shadow-[0_25px_80px_-15px_rgba(234,179,8,0.5)]'}`}
            >
              <span className="relative z-10 italic uppercase tracking-tighter">
                {status === 'spinning' ? "ĐANG QUAY..." : "BẮT ĐẦU"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Popup chúc mừng */}
      {showPopup && winner && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 md:p-10 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500">
           <div className="w-full max-w-4xl bg-slate-900 border-b-[12px] border-yellow-500 rounded-[50px] md:rounded-[80px] p-10 md:p-16 lg:p-20 text-center shadow-[0_0_150px_rgba(234,179,8,0.4)] animate-winner-reveal relative overflow-y-auto max-h-[95vh] custom-scrollbar">
              <button onClick={() => setShowPopup(false)} className="absolute top-8 right-8 text-slate-600 text-3xl hover:text-white transition-colors"><i className="fas fa-times"></i></button>
              
              <div className="mb-6"><span className="bg-yellow-500 text-slate-950 px-8 py-2 rounded-full font-black text-sm md:text-lg uppercase tracking-[0.5em] border-2 border-white/20 shadow-xl">XIN CHÚC MỪNG!</span></div>
              
              <div className="relative mb-8 md:mb-12 flex justify-center">
                 <img src={winner.image} className="w-40 h-40 md:w-60 lg:w-72 object-contain relative z-10 animate-winner-bounce drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]" alt="winner" />
              </div>
              
              <h2 className="text-4xl md:text-7xl lg:text-8xl font-black text-white mb-8 md:mb-10 italic leading-none uppercase tracking-tighter drop-shadow-lg">{winner.name}</h2>
              
              <div className="bg-black/60 p-8 md:p-12 lg:p-16 rounded-[40px] md:rounded-[60px] text-left border border-white/10 shadow-inner relative overflow-hidden">
                 <p className="text-slate-100 text-xl md:text-3xl lg:text-4xl italic font-serif leading-relaxed text-center opacity-95">
                    {commentary || "Đang chuẩn bị..."}
                 </p>
                 {loadingCommentary && <div className="mt-8 flex justify-center gap-3 animate-pulse"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div><div className="w-3 h-3 bg-yellow-500 rounded-full delay-75"></div><div className="w-3 h-3 bg-yellow-500 rounded-full delay-150"></div></div>}
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(234, 179, 8, 0.4); border-radius: 10px; }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 15s linear infinite; }
        @keyframes winner-reveal { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-winner-reveal { animation: winner-reveal 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes winner-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .animate-winner-bounce { animation: winner-bounce 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;

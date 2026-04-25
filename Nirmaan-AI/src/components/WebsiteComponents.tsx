import React, { useState } from "react";
import { motion } from "motion/react";
import { Menu, X, ArrowRight, User, Star, Mail, MapPin, Phone } from "lucide-react";

// Helper for editable classes
const getEditableProps = (id: string, isEditing: boolean) => ({
  id,
  "data-editable": "true",
  className: isEditing ? "relative ring-2 ring-bento-accent ring-offset-2 ring-offset-black cursor-pointer group" : "",
});

export const Navbar = ({ data = {}, onNavigate, currentPage, isEditing, onEdit }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <nav className="fixed w-full z-50 bg-black/60 backdrop-blur-xl border-b border-bento-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex-shrink-0 font-black text-2xl tracking-tighter text-white">
            {data.logo || "NIRMAAN"}<span className="text-bento-accent">AI</span>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-10">
              {data.links?.map((link: any) => (
                <button
                  key={link.path}
                  onClick={() => onNavigate(link.path)}
                  className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${currentPage === link.path ? 'text-bento-accent' : 'text-bento-text-dim hover:text-white'}`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-white">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export const Hero = ({ data = {}, isEditing, onEdit }: any) => (
  <section id="hero" data-component="hero" className="relative pt-40 pb-20 lg:pt-56 lg:pb-32 overflow-hidden bg-black px-6">
    <div className="max-w-7xl mx-auto relative z-10">
      <div className="bento-card border-none bg-gradient-to-br from-[#1e1e2d] to-bento-card p-12 md:p-20 text-center rounded-[40px] shadow-2xl">
        <motion.h1 
          {...getEditableProps(data.titleId, isEditing)}
          onClick={() => onEdit(data.titleId, data.title)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-8xl font-black tracking-tight text-white mb-8 leading-[1.05]"
        >
          {data.title}
        </motion.h1>
        <motion.p 
          {...getEditableProps(data.subtitleId, isEditing)}
          onClick={() => onEdit(data.subtitleId, data.subtitle)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto text-xl text-bento-text-dim mb-12 font-medium"
        >
          {data.subtitle}
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-4"
        >
          <button className="px-10 py-5 bg-bento-accent text-white rounded-2xl font-bold hover:bg-blue-600 transition-all flex items-center gap-3 shadow-xl shadow-bento-accent/20 tracking-wider text-sm uppercase">
            {data.buttonText} <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-16 flex justify-center"
      >
        <img 
          src={data.image} 
          alt="Dashboard" 
          referrerPolicy="no-referrer"
          className="rounded-[40px] shadow-[0_0_100px_rgba(59,130,246,0.15)] border border-bento-border w-full max-w-5xl object-cover"
          style={{ maxHeight: '550px' }}
        />
      </motion.div>
    </div>
  </section>
);

export const Features = ({ data = {}, isEditing, onEdit }: any) => (
  <section id="features" data-component="features" className="py-32 bg-black px-6">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-20">
        <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-bento-accent mb-4">Core Systems</h2>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white">Engineered for Excellence</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {data.items?.map((item: any, idx: number) => (
          <div key={idx} className="bento-card group hover:scale-[1.02]">
            <div className="w-14 h-14 bg-bento-accent/10 border border-bento-accent/20 rounded-2xl flex items-center justify-center text-bento-accent mb-8 group-hover:bg-bento-accent group-hover:text-white transition-all">
              <Star className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4 leading-tight">{item.title}</h3>
            <p className="text-bento-text-dim text-base font-medium leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const Testimonials = ({ data = {}, isEditing, onEdit }: any) => (
  <section id="testimonials" data-component="testimonials" className="py-32 bg-black px-6">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bento-card bg-gradient-to-br from-white/5 to-transparent p-12 flex flex-col justify-center">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-10 leading-tight">Neural Feedback Loop</h2>
          <div className="space-y-10">
            {data.items?.map((item: any, idx: number) => (
              <div key={idx} className="border-l-2 border-bento-accent pl-8 py-2">
                <p className="text-xl text-bento-text-dim font-medium italic mb-6 leading-relaxed">"{item.quote}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
                    <User className="w-7 h-7 text-white/40" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-lg tracking-tight">{item.author}</div>
                    <div className="text-sm text-bento-text-dim font-bold uppercase tracking-widest">{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-full">
           <img 
            src={data.image || "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80"} 
            alt="Customer success" 
            referrerPolicy="no-referrer"
            className="rounded-[40px] shadow-2xl w-full h-[600px] object-cover border border-bento-border/50"
          />
        </div>
      </div>
    </div>
  </section>
);

export const Footer = ({ data = {} }: any) => (
  <footer id="footer" data-component="footer" className="bg-[#050505] text-white py-32 border-t border-bento-border/30 px-6">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-16 border-b border-white/5 pb-24">
        <div className="col-span-1 md:col-span-2">
          <div className="text-3xl font-black tracking-tighter mb-8">{data.companyName}<span className="text-bento-accent">AI</span></div>
          <p className="text-bento-text-dim text-lg font-medium max-w-sm leading-relaxed">{data.tagline}</p>
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white mb-10">Systems</h4>
          <ul className="space-y-6 text-bento-text-dim text-sm font-bold uppercase tracking-widest">
            <li><button className="hover:text-bento-accent transition-colors">Neural Hub</button></li>
            <li><button className="hover:text-bento-accent transition-colors">Architecture</button></li>
            <li><button className="hover:text-bento-accent transition-colors">Deployment</button></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white mb-10">Neural Node</h4>
          <ul className="space-y-6 text-bento-text-dim text-sm font-medium">
            <li className="flex items-center gap-4"><Mail className="w-5 h-5 text-bento-accent" /> hello@nirmaan.ai</li>
            <li className="flex items-center gap-4"><MapPin className="w-5 h-5 text-bento-accent" /> Silicon Valley, CA</li>
          </ul>
        </div>
      </div>
      <div className="mt-16 text-center text-bento-text-dim text-[10px] font-bold uppercase tracking-[0.4em]">
        &copy; {new Date().getFullYear()} {data.companyName} Engine. All Rights Reserved.
      </div>
    </div>
  </footer>
);

export const ComponentSelector: React.FC<{
  componentType: string;
  data?: any;
  isEditing: boolean;
  onEdit: (id: string, initialValue: string) => void;
  onNavigate: (path: string) => void;
  currentPage: string;
}> = ({ componentType, data = {} as any, isEditing, onEdit, onNavigate, currentPage }) => {
  switch (componentType) {
    case "navbar":
      return <Navbar data={data} currentPage={currentPage} onNavigate={onNavigate} isEditing={isEditing} onEdit={onEdit} />;
    case "hero":
      return <Hero data={data} isEditing={isEditing} onEdit={onEdit} />;
    case "features":
      return <Features data={data} isEditing={isEditing} onEdit={onEdit} />;
    case "testimonials":
      return <Testimonials data={data} isEditing={isEditing} onEdit={onEdit} />;
    case "footer":
      return <Footer data={data} />;
    case "about-content":
      return (
        <section className="py-32 bg-black px-6">
          <div className="max-w-4xl mx-auto bento-card p-12 md:p-20">
            <h1 className="text-4xl md:text-6xl font-black mb-10 text-center text-white">{data.title}</h1>
            <p className="text-xl text-bento-text-dim leading-relaxed mb-12 font-medium">{data.content}</p>
            <img src={data.image} alt="About" className="rounded-[32px] w-full border border-bento-border/50 shadow-2xl" referrerPolicy="no-referrer" />
          </div>
        </section>
      );
    case "contact-form":
      return (
        <section className="py-32 bg-black px-6">
          <div className="max-w-7xl mx-auto">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="bento-card bg-gradient-to-br from-bento-card to-black p-12 lg:p-20">
                   <h2 className="text-4xl md:text-6xl font-black mb-8 text-white">Neural Uplink</h2>
                   <p className="text-xl text-bento-text-dim mb-12 font-medium leading-relaxed">{data.description}</p>
                   <div className="space-y-8">
                      <div className="flex items-center gap-6 group">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-bento-accent border border-white/5 group-hover:border-bento-accent transition-all"><Mail className="w-7 h-7" /></div>
                        <div><div className="text-[10px] font-bold uppercase tracking-widest text-bento-text-dim mb-1">Electronic Mail</div><div className="text-white font-bold text-lg">hello@nirmaan.ai</div></div>
                      </div>
                      <div className="flex items-center gap-6 group">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-bento-accent border border-white/5 group-hover:border-bento-accent transition-all"><Phone className="w-7 h-7" /></div>
                        <div><div className="text-[10px] font-bold uppercase tracking-widest text-bento-text-dim mb-1">Voice Node</div><div className="text-white font-bold text-lg">+1 (555) 000-0000</div></div>
                      </div>
                   </div>
                </div>
                <div className="bento-card p-12 lg:p-20 border-bento-accent/20 bg-black">
                   <form className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-bento-text-dim uppercase tracking-[0.2em] ml-1">Identity Tag</label>
                        <input type="text" placeholder="Your Name" className="w-full bg-white/5 px-6 py-4 rounded-2xl border border-bento-border focus:border-bento-accent outline-none text-white transition-all placeholder:text-gray-700" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-bento-text-dim uppercase tracking-[0.2em] ml-1">Digital Address</label>
                        <input type="email" placeholder="email@address.com" className="w-full bg-white/5 px-6 py-4 rounded-2xl border border-bento-border focus:border-bento-accent outline-none text-white transition-all placeholder:text-gray-700" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-bento-text-dim uppercase tracking-[0.2em] ml-1">Message Stream</label>
                        <textarea rows={4} placeholder="How can Nirmaan assist..." className="w-full bg-white/5 px-6 py-4 rounded-2xl border border-bento-border focus:border-bento-accent outline-none text-white transition-all resize-none placeholder:text-gray-700"></textarea>
                      </div>
                      <button className="w-full py-5 bg-bento-accent text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-600 transition-all shadow-xl shadow-bento-accent/10">Synchronize Message</button>
                   </form>
                </div>
             </div>
          </div>
        </section>
      );
    default:
      return null;
  }
};

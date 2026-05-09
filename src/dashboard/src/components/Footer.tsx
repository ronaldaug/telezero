export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-white/5 py-10">
      <div className="container mx-auto px-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/20 mb-2">
          Designed for the future of automation
        </div>
        <div className="text-cyber-blue/30 text-[10px] flex items-center justify-center gap-4">
          <span>// ENCRYPTED</span>
          <span>// ANONYMOUS</span>
          <span>// SCALEABLE</span>
        </div>
        <div className="text-cyber-blue/20 text-[10px] mt-4">
          &copy; {new Date().getFullYear()} TeleZero. All rights reserved.
        </div>
        <p className="text-center text-xs text-white/20">
          Built with ❤️ by the TeleZero team from 🇲🇲
        </p>
      </div>
    </footer>
  );
};
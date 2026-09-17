// Vorlesen über die kostenlose Sprachausgabe des Browsers (offline auf den meisten Geräten)
let enabled = true;
export const setSpeechEnabled = (v) => { enabled = v; };

function germanVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.find((v) => /^de/i.test(v.lang) && /(Premium|Enhanced|Natural|Anna|Markus)/i.test(v.name))
      || voices.find((v) => /^de/i.test(v.lang));
}

export function speak(text, { force = false } = {}) {
  if ((!enabled && !force) || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.voice = germanVoice() ?? null;
  u.rate = 0.9; // bewusst etwas langsamer
  speechSynthesis.speak(u);
}

export const stopSpeaking = () => window.speechSynthesis?.cancel();

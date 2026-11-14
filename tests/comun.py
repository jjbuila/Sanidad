"""Utilidades comunes de las pruebas (Playwright + app servida en http://127.0.0.1:8765).

PW_CANAL: canal del navegador (por ejemplo «msedge» en Windows). Vacío = Chromium de Playwright (CI).
"""
import os, tempfile
CANAL = {'channel': os.environ['PW_CANAL']} if os.environ.get('PW_CANAL') else {}
PLANTACION = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'plantacion_prueba.geojson')
TMP = tempfile.mkdtemp(prefix='sanidad_pruebas_')
# Reconocimiento y síntesis de voz simulados (para las pruebas del diagnóstico por voz)
INIT_VOZ = """
window.__dichos=[];
class FakeSR{constructor(){window.__sr=this;this.continuous=false;}start(){window.__sr=this;window.__srOn=true;}abort(){window.__srOn=false;setTimeout(()=>this.onend&&this.onend(),5);}stop(){this.abort();}}
window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR;
window.__hablar=t=>{const r=window.__sr;if(!r||!window.__srOn)return false;const alt={transcript:t};const res=[alt];res.isFinal=true;r.onresult&&r.onresult({resultIndex:0,results:[res]});return true;};
const ss={speak(u){window.__dichos.push(u.text);setTimeout(()=>u.onend&&u.onend(),15);},cancel(){},getVoices(){return [];},onvoiceschanged:null};
Object.defineProperty(window,'speechSynthesis',{value:ss,configurable:true});
"""

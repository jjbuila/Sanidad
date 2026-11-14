"""Nuevas opciones del censo: Espacio vacío, Deficiencia de boro (Enfermedad principal) y Yarumo en palma."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from comun import CANAL, INIT_VOZ, PLANTACION, TMP
import sys, time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
ok = True
def check(n, c, x=''):
    global ok
    print(('OK   ' if c else 'FALLA') + ' ' + n + (' · ' + str(x) if x != '' else '')); ok = ok and bool(c)
errores = []
with sync_playwright() as p:
    nav = p.chromium.launch(**CANAL, headless=True)
    ctx = nav.new_context(service_workers='block', viewport={'width': 412, 'height': 900})
    ctx.route('https://api.github.com/**', lambda r: r.fulfill(status=404, body='{}'))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(str(e)[:200])); pg.on('dialog', lambda d: (errores.append('ALERTA: ' + d.message), d.dismiss()))
    pg.goto('http://127.0.0.1:8765/index.html'); pg.wait_for_function("typeof abrirFormulario==='function'", timeout=30000); time.sleep(2)
    pg.evaluate("""async()=>{document.querySelector('#login').hidden=true;SES={u:'op1',nombre:'Operario Uno',rol:'operario'};
      const j={id:'JR',estado:'activa',evaluador:'Operario Uno',usuario:'op1',inicio:new Date().toISOString(),seleccion:[{lote:'IT01'}],densidad:115,buffer:5,km:0,sync:'pendiente'};
      await dbPut('jornadas',j);S.jornada=j;S.cfg.jornadaActiva='JR';S.gps={lat:1.70002,lng:-78.70,acc:4,t:Date.now()};
      for(const [id,n] of [['P1',1],['P2',2],['P3',3],['P4',4]])S.idx.set(id,{type:'Feature',geometry:{type:'Point',coordinates:[-78.70,1.70]},properties:{_id:id,_lote:'IT01',_linea:5,_num:n}});}""")
    ops = pg.evaluate("(async()=>{await abrirFormulario({palma_id:'P1'});return [...document.querySelectorAll('#frm input[name=n1]')].map(i=>i.nextElementSibling.textContent)})()")
    check('Enfermedad principal incluye «Espacio vacío» y «Deficiencia de boro»', 'ESPACIO VACÍO' in ops and 'DEFICIENCIA DE BORO' in ops, ops)
    check('Se conserva «Deficiencias»', 'DEFICIENCIAS' in ops)
    def llenar_guardar(pid, n1, n2=None, extra=None):
        return pg.evaluate("""async([pid,n1,n2,extra])=>{await abrirFormulario({palma_id:pid});const frm=document.querySelector('#frm');
          const mk=(name,val)=>{const i=[...frm.querySelectorAll(`input[name="${name}"]`)].find(x=>x.value===val||x.nextElementSibling.textContent===val);if(!i)return false;i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));return true;};
          const v=[...frm.querySelectorAll('input[name=n1]')].find(i=>i.nextElementSibling.textContent===n1).value;mk('n1',v);
          const n2ops=[...frm.querySelectorAll('input[name=n2]')].map(i=>i.value);if(n2)mk('n2',n2);
          const grupos=[...frm.querySelectorAll('label.campo')].map(l=>l.textContent.replace('*','').trim());
          const sint=[...frm.querySelectorAll('input[name=sintomas]')].map(i=>i.value);
          for(const [k,val] of Object.entries(extra||{}))mk(k,val);
          F.fotosNuevas.push({id:'F'+pid,buf:new ArrayBuffer(8),type:'image/jpeg'});
          const id=F.r.id;await guardarRegistro(frm);const r=S.registros.find(x=>x.id===id);
          return {n2ops,grupos,sint,guardado:!!r,estado:r&&r.estado,n1:r&&r.n1,n2:r&&r.n2,color:r&&colorReg(r),sintR:r&&r.sintomas};}""", [pid, n1, n2, extra])
    ev = llenar_guardar('P1', 'ESPACIO VACÍO', None, {'transitabilidad': 'Transitable'})
    check('Espacio vacío: guarda con estado «faltante»', ev['guardado'] and ev['estado'] == 'faltante' and ev['sintR'] == ['Sitio de siembra sin palma'], ev)
    check('Espacio vacío: no pide producción, cirugía ni raíces', not any(g in ' '.join(ev['grupos']) for g in ['Producción', 'Cirugía', 'Raíces']), ev['grupos'])
    bo = llenar_guardar('P2', 'DEFICIENCIA DE BORO', None, {'sintomas': 'Hojas en forma de gancho o anzuelo', 'produccion': 'Sí', 'raices': 'Sí', 'transitabilidad': 'Transitable'})
    check('Deficiencia de boro: síntomas propios y guarda como enferma', bo['guardado'] and bo['estado'] == 'enferma' and len(bo['sint']) == 5 and bo['color'] == '#ffb300', bo)
    ya = llenar_guardar('P3', 'YARUMO', 'YARUMO EN PALMA', {'produccion': 'Sí', 'raices': 'Sí', 'transitabilidad': 'Transitable'})
    check('Yarumo: opciones en calle, en lote y en palma', ya['n2ops'] == ['YARUMO EN CALLE', 'YARUMO EN LOTE', 'YARUMO EN PALMA'], ya['n2ops'])
    check('Yarumo en palma: guarda como novedad', ya['guardado'] and ya['n2'] == 'YARUMO EN PALMA' and ya['estado'] == 'novedad', ya)
    # Dictado por voz
    dic = pg.evaluate("""async()=>{const out={};
      for(const [pid,frase] of [['P4','deficiencia de boro síntomas hojas en forma de gancho'],['P4','espacio vacío transitabilidad transitable'],['P4','yarumo en palma producción sí']]){
        await abrirFormulario({palma_id:pid});aplicarDictado(tokV(frase));
        const sel=n=>[...document.querySelectorAll(`#frm input[name=${n}]:checked`)].map(i=>i.nextElementSibling.textContent);
        out[frase]={n1:sel('n1'),n2:sel('n2'),sint:sel('sintomas'),tra:sel('transitabilidad')};}
      return out;}""")
    v = list(dic.values())
    check('Dictado: «deficiencia de boro» (no «deficiencias»)', v[0]['n1'] == ['DEFICIENCIA DE BORO'] and any('gancho' in x for x in v[0]['sint']), v[0])
    check('Dictado: «espacio vacío»', v[1]['n1'] == ['ESPACIO VACÍO'] and v[1]['tra'] == ['Transitable'], v[1])
    check('Dictado: «yarumo en palma»', v[2]['n1'] == ['YARUMO'] and v[2]['n2'] == ['YARUMO EN PALMA'], v[2])
    check('Sin errores ni alertas', not errores, errores[:3])
    # Visor: nombre y color
    vz = ctx.new_page(); vz.goto('http://127.0.0.1:8765/visor.html'); vz.wait_for_function("typeof PROBLEMAS!=='undefined'", timeout=20000)
    check('Visor: nombres y colores nuevos', vz.evaluate("PROBLEMAS.BORO==='Deficiencia de boro'&&PROBLEMAS.EV==='Espacio vacío'&&COLOR_N1.BORO&&COLOR_N1.EV"))
    nav.close()
print('\nRESULTADO:', 'TODO OK' if ok else 'HAY FALLAS'); sys.exit(0 if ok else 1)

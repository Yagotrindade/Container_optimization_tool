import { state } from '../store/state.js';
import { processarCargas } from '../core/container.js'; // Removi o reescalarProjeto daqui

export function abrirTutorial() { document.getElementById('modalTutorial').style.display = 'block'; }

export function fecharTutorial() {
    if (document.getElementById('chkNaoMostrarNovamente').checked) localStorage.setItem('logisim_tutorial_hidden', 'true');
    document.getElementById('modalTutorial').style.display = 'none';
}

export function toggleSidebar() { document.getElementById('app-sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }

export function ajustarEscalaResponsiva() {
    const w = window.innerWidth; let n = 60;
    if (w <= 480) n = 26; else if (w <= 1024) n = 45;
    if (n !== state.ESCALA) { state.ESCALA = n; if (document.getElementById('container-floor')) reescalarProjeto(); }
}

export function reescalarProjeto() {
    const cfg = state.containers[document.getElementById('tipoContainer').value];
    const floor = document.getElementById('container-floor');
    const side = document.getElementById('side-view-container');
    floor.style.width = (cfg.comprimento * state.ESCALA) + 'px'; floor.style.height = (cfg.largura * state.ESCALA) + 'px';
    side.style.width = floor.style.width; side.style.height = (state.ALTURA_MAX * state.ESCALA) + 'px';
    state.paletes.forEach(p => { const el = document.getElementById(p.id); if (el) { el.style.width = (p.comp * state.ESCALA) + "px"; el.style.height = (p.larg * state.ESCALA) + "px"; el.style.left = (p.x * state.ESCALA) + "px"; el.style.top = (p.y * state.ESCALA) + "px"; } });
    processarCargas();
}

export function atualizarLabelsMedida() {
    const und = document.getElementById('unidadeMedida').value;
    document.getElementById('lblComp').innerText = `C (${und})`; document.getElementById('lblLarg').innerText = `L (${und})`; document.getElementById('lblAlt').innerText = `A (${und})`;
    const step = und === 'm' ? '0.05' : (und === 'cm' ? '1' : '10');
    document.getElementById('pComprimento').step = step; document.getElementById('pLargura').step = step; document.getElementById('pAltura').step = step;
    setTamanhoPadrao();
}

export function setTamanhoPadrao() {
    const und = document.getElementById('unidadeMedida').value; let f = 1; if (und === 'cm') f = 100; if (und === 'mm') f = 1000;
    document.getElementById('pComprimento').value = (1.2 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('pLargura').value = (1.0 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('pAltura').value = (1.1 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('pPeso').value = 500;
}

export function mostrarFeedback(x, y) { const fb = document.getElementById('feedback-msg'); fb.style.left = (x - 60) + "px"; fb.style.top = (y - 40) + "px"; fb.style.display = 'block'; setTimeout(() => fb.style.display = 'none', 1500); }

export function mostrarTooltip(e, p) {
    const tt = document.getElementById('tooltip-info'); let html = `<strong>${p.nome}</strong><br>Peso Total: ${p.peso}kg | Dim: ${p.comp}x${p.larg}m<hr>`;
    if (p.itensInternos && p.itensInternos.length > 0) {
        p.itensInternos.forEach(i => {
            const dim = `${i.comp || 0}x${i.larg || 0}x${i.alt || 0}m`; const pos = `X:${i.x || 0}, Y:${i.y || 0}, Z:${i.z || 0}`;
            // Agora renderiza perfeitamente o ID e a Descrição salva!
            html += `• <b>[${i.id || 'S/ID'}]</b> ${i.desc || 'Sem desc.'} <br>  <span style="color:#94a3b8; font-size:10px; margin-left:10px;">Dim: ${dim} | Posição: ${pos}</span><br>`;
        });
    } else { html += "<em style='color:#94a3b8;'>Sem sub-itens desenhados</em>"; }
    tt.innerHTML = html; tt.style.display = 'block';
}

export function moverTooltip(e) { const tt = document.getElementById('tooltip-info'); tt.style.left = (e.clientX + 15) + "px"; tt.style.top = (e.clientY + 15) + "px"; }

export function esconderTooltip() { document.getElementById('tooltip-info').style.display = 'none'; }
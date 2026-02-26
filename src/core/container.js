import { state } from '../store/state.js';
import { calcularAutoTilt, detectarColisao, buscarMelhorPosicao } from './physics.js';
import { atualizarTabelaImpressao } from '../utils/io.js';
import { mostrarTooltip, moverTooltip, esconderTooltip, mostrarFeedback } from '../ui/interface.js';
import { abrirModalDetalhes } from '../wms/palletEditor.js';

export function mudarContainer() { limparContainer(); }

export function limparContainer() {
    state.paletes = []; const cfg = state.containers[document.getElementById('tipoContainer').value]; const floor = document.getElementById('container-floor');
    floor.innerHTML = '<div id="cg-indicator-point"></div><div id="feedback-msg">ESPAÇO INDISPONÍVEL</div>';
    floor.style.width = (cfg.comprimento * state.ESCALA) + 'px'; floor.style.height = (cfg.largura * state.ESCALA) + 'px';
    document.getElementById('pesoDisplay').innerText = `0 / ${cfg.pesoMax} kg`; document.getElementById('progressFill').style.width = '0%'; document.getElementById('resultados').style.display = 'none';
    document.getElementById('side-view-container').style.width = floor.style.width; document.getElementById('side-view-container').style.height = (state.ALTURA_MAX * state.ESCALA) + 'px';
    renderSide();
}

export function adicionarNovoPalete() {
    const nome = document.getElementById('pNome').value || "P-" + (state.paletes.length + 1);
    const und = document.getElementById('unidadeMedida').value; let div = 1; if (und === 'cm') div = 100; if (und === 'mm') div = 1000;
    const comp = parseFloat(document.getElementById('pComprimento').value) / div;
    const larg = parseFloat(document.getElementById('pLargura').value) / div;
    const alt = parseFloat(document.getElementById('pAltura').value) / div;
    const peso = parseFloat(document.getElementById('pPeso').value);
    const zDesj = parseInt(document.getElementById('pNivelDesejado').value);
    const emp = document.getElementById('pEmpilhavel').checked;
    const cfg = state.containers[document.getElementById('tipoContainer').value];

    if (peso + state.paletes.reduce((s, p) => s + p.peso, 0) > cfg.pesoMax) return alert("Peso Máximo Excedido!");

    let ponto = null, infoTilt = null;
    for (let x = 0; x <= cfg.comprimento - comp; x += 0.05) {
        for (let y = 0; y <= cfg.largura - larg; y += 0.05) {
            if (!detectarColisao('', x, y, comp, larg, zDesj)) {
                if (zDesj === 0) { ponto = { x, y }; break; }
                else { const res = calcularAutoTilt(x, y, comp, larg, alt); if (res && res.possivel) { ponto = { x, y }; infoTilt = res; break; } }
            }
        } if (ponto) break;
    }
    if (!ponto) return alert("Sem espaço disponível!");
    const novo = { id: "p_" + Date.now(), nome, comp, larg, alt, peso, emp, x: ponto.x, y: ponto.y, z: zDesj, itensInternos: [], tilted: infoTilt?.tilt || false, angulo: infoTilt?.angulo || 0 };
    state.paletes.push(novo); renderizar(novo); processarCargas();
}

export function renderizar(p) {
    const div = document.createElement('div'); div.className = `palete ${p.tilted ? 'tilted' : ''} ${p.emp ? 'empilhavel' : ''}`; div.id = p.id;
    div.style.width = (p.comp * state.ESCALA) + "px"; div.style.height = (p.larg * state.ESCALA) + "px"; div.style.left = (p.x * state.ESCALA) + "px"; div.style.top = (p.y * state.ESCALA) + "px";
    div.style.backgroundColor = p.z === 0 ? "var(--z0-color)" : "var(--z1-color)";
    if (p.tilted) div.style.transform = `perspective(500px) rotateY(${p.angulo / 2}deg)`;
    div.innerHTML = `<span class="btn-delete" onclick="remover('${p.id}')" style="position:absolute;top:2px;right:18px;cursor:pointer;background:rgba(0,0,0,0.4);border-radius:50%;width:16px;height:16px;line-height:14px;text-align:center;">×</span><span class="palete-title">${p.nome}</span>`;
    div.onmouseenter = (e) => mostrarTooltip(e, p); div.onmousemove = (e) => moverTooltip(e); div.onmouseleave = () => esconderTooltip();
    document.getElementById('container-floor').appendChild(div); tornarArrastavel(div, p); filtrarNivel(state.nivelVisivel);
}

export function tornarArrastavel(elm, obj) {
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0, oldX = obj.x, oldY = obj.y, ultTap = 0;
    function iniciarArrasto(e) {
        if (e.target.innerText === '×') return;
        if (e.type === 'touchstart') { const t = new Date().getTime(); if (t - ultTap < 300 && t - ultTap > 0) { e.preventDefault(); abrirModalDetalhes(obj.id); return; } ultTap = t; }
        else if (e.type === 'mousedown' && e.detail === 2) { abrirModalDetalhes(obj.id); return; }
        oldX = obj.x; oldY = obj.y; elm.style.zIndex = 1000;
        const cX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX, cY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        p3 = cX; p4 = cY;
        if (e.type.includes('mouse')) { document.onmousemove = moverElemento; document.onmouseup = finalizarArrasto; }
        else { document.ontouchmove = moverElemento; document.ontouchend = finalizarArrasto; document.ontouchcancel = finalizarArrasto; }
    }
    function moverElemento(e) {
        const cX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX, cY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        p1 = p3 - cX; p2 = p4 - cY; p3 = cX; p4 = cY;
        let nx = (elm.offsetLeft - p1) / state.ESCALA, ny = (elm.offsetTop - p2) / state.ESCALA; const cfg = state.containers[document.getElementById('tipoContainer').value];
        nx = Math.max(0, Math.min(nx, cfg.comprimento - obj.comp));
        ny = Math.max(0, Math.min(ny, cfg.largura - obj.larg));
        elm.style.left = (nx * state.ESCALA) + "px"; elm.style.top = (ny * state.ESCALA) + "px"; obj.x = nx; obj.y = ny;
    }
    function finalizarArrasto(e) {
        document.onmousemove = null; document.onmouseup = null; document.ontouchmove = null; document.ontouchend = null; document.ontouchcancel = null;
        elm.style.zIndex = obj.z + 10;
        const resTilt = obj.z === 1 ? calcularAutoTilt(obj.x, obj.y, obj.comp, obj.larg, obj.alt) : { possivel: true };
        const valid = resTilt?.possivel && !detectarColisao(obj.id, obj.x, obj.y, obj.comp, obj.larg, obj.z);
        if (!valid) {
            const m = buscarMelhorPosicao(obj);
            if (m) { obj.x = m.x; obj.y = m.y; if (obj.z === 1) { const nt = calcularAutoTilt(obj.x, obj.y, obj.comp, obj.larg, obj.alt); obj.tilted = nt?.tilt || false; obj.angulo = nt?.angulo || 0; } }
            else { obj.x = oldX; obj.y = oldY; let fx = window.innerWidth / 2, fy = window.innerHeight / 2; if (e.type.includes('mouse')) { fx = e.clientX; fy = e.clientY; } else if (e.changedTouches && e.changedTouches.length > 0) { fx = e.changedTouches[0].clientX; fy = e.changedTouches[0].clientY; } mostrarFeedback(fx, fy); }
        } else if (obj.z === 1) { obj.tilted = resTilt.tilt; obj.angulo = resTilt.angulo; }
        elm.style.left = (obj.x * state.ESCALA) + "px"; elm.style.top = (obj.y * state.ESCALA) + "px";
        elm.className = `palete ${obj.tilted ? 'tilted' : ''} ${obj.emp ? 'empilhavel' : ''}`; elm.style.transform = obj.tilted ? `perspective(500px) rotateY(${obj.angulo / 2}deg)` : 'none'; processarCargas();
    }
    elm.onmousedown = iniciarArrasto; elm.ontouchstart = iniciarArrasto;
}

export function processarCargas() {
    const total = state.paletes.reduce((s, p) => s + (p.peso || 0), 0); const cfg = state.containers[document.getElementById('tipoContainer').value];
    document.getElementById('pesoDisplay').innerText = `${total} / ${cfg.pesoMax} kg`; document.getElementById('progressFill').style.width = (total / cfg.pesoMax * 100) + '%';
    const resDiv = document.getElementById('resultados');
    if (total === 0) { document.getElementById('cg-indicator-point').style.display = 'none'; resDiv.style.display = 'none'; renderSide(); atualizarTabelaImpressao(); return; }
    resDiv.style.display = 'block'; let mX = 0, mY = 0;
    state.paletes.forEach(p => { mX += p.peso * (p.x + p.comp / 2); mY += p.peso * (p.y + p.larg / 2); });
    const cgX = mX / total, cgY = mY / total, dx = cgX - (cfg.comprimento / 2), kgDeslocados = (Math.abs(dx) * total) / (cfg.comprimento / 2);
    const pt = document.getElementById('cg-indicator-point'); pt.style.display = 'block'; pt.style.left = (cgX * state.ESCALA) + "px"; pt.style.top = (cgY * state.ESCALA) + "px";
    document.getElementById('resPesoTotal').innerText = `Massa Bruta: ${total}kg`; document.getElementById('resDeslocamento').innerHTML = `Desvio Eixo X: ${Math.abs(dx).toFixed(2)}m (${dx > 0 ? 'Frente' : 'Fundo'})<br>Força de Alavanca: <b>${kgDeslocados.toFixed(0)}kg</b>`; document.getElementById('resSugestao').innerText = Math.abs(dx) > 0.3 ? `Alerta: Mova carga para o ${dx > 0 ? 'Fundo' : 'Frente'}.` : "Container Estável.";
    state.paletes.forEach(p => { const el = document.getElementById(p.id); if (p.z === 1) { const res = calcularAutoTilt(p.x, p.y, p.comp, p.larg, p.alt); if (res && res.tilt) { el.classList.add('tilted'); el.style.transform = `perspective(500px) rotateY(${res.angulo / 2}deg)`; } else { el.classList.remove('tilted'); el.style.transform = 'none'; } } });
    renderSide(); atualizarTabelaImpressao();
}

export function renderSide() {
    const side = document.getElementById('side-view-container'), yAxis = side.querySelector('.y-axis');
    side.innerHTML = ''; if (yAxis) side.appendChild(yAxis);
    state.paletes.forEach(p => {
        const b = document.createElement('div'); b.className = 'side-palete-block'; b.style.width = (p.comp * state.ESCALA) + "px"; b.style.height = (p.alt * state.ESCALA) + "px"; b.style.left = (p.x * state.ESCALA) + "px"; let hBase = 0;
        if (p.z === 1) { const res = calcularAutoTilt(p.x, p.y, p.comp, p.larg, p.alt); if (res && res.possivel) { hBase = res.hBase; if (res.tilt) { let originX = (res.pivotX - p.x) * state.ESCALA; b.style.transformOrigin = `${originX}px bottom`; b.style.transform = `rotate(${res.angulo}deg)`; } else { b.style.transformOrigin = `center bottom`; b.style.transform = `none`; } } }
        b.style.bottom = (hBase * state.ESCALA) + "px"; b.style.backgroundColor = p.z === 0 ? "var(--z0-color)" : "var(--z1-color)"; side.appendChild(b);
    });
}

export function filtrarNivel(z) { state.nivelVisivel = parseInt(z); state.paletes.forEach(p => { const el = document.getElementById(p.id); if (el) { el.style.opacity = (p.z === state.nivelVisivel) ? "1" : "0.15"; el.style.pointerEvents = (p.z === state.nivelVisivel) ? "all" : "none"; } }); }

export function remover(id) { state.paletes = state.paletes.filter(p => p.id !== id); document.getElementById(id).remove(); processarCargas(); }

export function limparTudoComConfirmacao() { if (confirm("Deseja apagar todo o planejamento?")) mudarContainer(); }
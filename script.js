let ESCALA = 60;
const ALTURA_MAX = 2.39;
const OVERHANG_MAX = 0.10;
let paletes = [];
let nivelVisivel = 0;

let itensPaleteEditado = [];
let paleteSendoEditado = null;
let ESCALA_PALETE = 150;
let nivelVisivelPalete = 0;

const containers = { "20": { largura: 2.35, comprimento: 5.9, pesoMax: 28000 }, "40": { largura: 2.35, comprimento: 12.0, pesoMax: 30000 } };

window.onload = () => {
    ajustarEscalaResponsiva(); mudarContainer();
    if (localStorage.getItem('logisim_tutorial_hidden') !== 'true') abrirTutorial();
};
window.addEventListener('resize', () => { ajustarEscalaResponsiva(); });

/** TUTORIAL E MENU BASE **/
function abrirTutorial() { document.getElementById('modalTutorial').style.display = 'block'; }
function fecharTutorial() {
    if (document.getElementById('chkNaoMostrarNovamente').checked) localStorage.setItem('logisim_tutorial_hidden', 'true');
    document.getElementById('modalTutorial').style.display = 'none';
}
function toggleSidebar() { document.getElementById('app-sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('active'); }

function ajustarEscalaResponsiva() {
    const w = window.innerWidth; let n = 60;
    if (w <= 480) n = 26; else if (w <= 1024) n = 45;
    if (n !== ESCALA) { ESCALA = n; if (document.getElementById('container-floor')) reescalarProjeto(); }
}

function reescalarProjeto() {
    const cfg = containers[document.getElementById('tipoContainer').value];
    const floor = document.getElementById('container-floor');
    const side = document.getElementById('side-view-container');
    floor.style.width = (cfg.comprimento * ESCALA) + 'px'; floor.style.height = (cfg.largura * ESCALA) + 'px';
    side.style.width = floor.style.width; side.style.height = (ALTURA_MAX * ESCALA) + 'px';
    paletes.forEach(p => { const el = document.getElementById(p.id); if (el) { el.style.width = (p.comp * ESCALA) + "px"; el.style.height = (p.larg * ESCALA) + "px"; el.style.left = (p.x * ESCALA) + "px"; el.style.top = (p.y * ESCALA) + "px"; } });
    processarCargas();
}

function mudarContainer() { limparContainer(); }
function limparContainer() {
    paletes = []; const cfg = containers[document.getElementById('tipoContainer').value]; const floor = document.getElementById('container-floor');
    floor.innerHTML = '<div id="cg-indicator-point"></div><div id="feedback-msg">ESPAÇO INDISPONÍVEL</div>';
    floor.style.width = (cfg.comprimento * ESCALA) + 'px'; floor.style.height = (cfg.largura * ESCALA) + 'px';
    document.getElementById('pesoDisplay').innerText = `0 / ${cfg.pesoMax} kg`; document.getElementById('progressFill').style.width = '0%'; document.getElementById('resultados').style.display = 'none';
    document.getElementById('side-view-container').style.width = floor.style.width; document.getElementById('side-view-container').style.height = (ALTURA_MAX * ESCALA) + 'px';
    renderSide();
}

/** CONVERSORES E FÍSICA **/
function atualizarLabelsMedida() {
    const und = document.getElementById('unidadeMedida').value;
    document.getElementById('lblComp').innerText = `C (${und})`; document.getElementById('lblLarg').innerText = `L (${und})`; document.getElementById('lblAlt').innerText = `A (${und})`;
    const step = und === 'm' ? '0.05' : (und === 'cm' ? '1' : '10');
    document.getElementById('pComprimento').step = step; document.getElementById('pLargura').step = step; document.getElementById('pAltura').step = step;
    setTamanhoPadrao();
}
function setTamanhoPadrao() {
    const und = document.getElementById('unidadeMedida').value; let f = 1; if (und === 'cm') f = 100; if (und === 'mm') f = 1000;
    document.getElementById('pComprimento').value = (1.2 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('pLargura').value = (1.0 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('pAltura').value = (1.1 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('pPeso').value = 500;
}

function detectarColisao(uniqueId, nx, ny, nw, nh, nz, array = paletes) {
    const EPSILON = 0.005;
    return array.some(p => (p.uuid || p.id) !== uniqueId && p.z === nz &&
        !(nx + nw <= p.x + EPSILON || nx >= p.x + p.comp - EPSILON ||
            ny + nh <= p.y + EPSILON || ny >= p.y + p.larg - EPSILON));
}

function calcularAutoTilt(nx, ny, nw, nh, nAlt) {
    const bases = paletes.filter(p => p.z === 0 && p.emp && !(nx + nw <= p.x || nx >= p.x + p.comp || ny + nh <= p.y || ny >= p.y + p.larg));
    if (bases.length === 0) return { possivel: false };
    let area = 0; bases.forEach(b => { area += (Math.max(0, Math.min(nx + nw, b.x + b.comp) - Math.max(nx, b.x)) * Math.max(0, Math.min(ny + nh, b.y + b.larg) - Math.max(ny, b.y))); });
    if ((area / (nw * nh)) < (1 - OVERHANG_MAX)) return { possivel: false };
    let maxH = -1, mxL = nx + nw, mxR = nx;
    for (let x = nx; x <= nx + nw + 0.001; x += 0.01) {
        let h_at_x = 0; for (let b of bases) { if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) { if (b.alt > h_at_x) h_at_x = b.alt; } }
        if (h_at_x > maxH) { maxH = h_at_x; mxL = x; mxR = x; } else if (Math.abs(h_at_x - maxH) < 0.001) { if (x < mxL) mxL = x; if (x > mxR) mxR = x; }
    }
    let cx = nx + nw / 2, tilt = false, ang = 0, piv = nx;
    if (cx >= mxL && cx <= mxR) { tilt = false; piv = nx; ang = 0; }
    else if (cx > mxR) {
        tilt = true; piv = mxR; let mA = Math.PI / 2;
        for (let x = piv + 0.01; x <= nx + nw + 0.001; x += 0.01) {
            let h_at_x = 0; for (let b of bases) { if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) { if (b.alt > h_at_x) h_at_x = b.alt; } }
            let a = Math.atan2(maxH - h_at_x, x - piv); if (a < mA) mA = a;
        } ang = mA * (180 / Math.PI);
    } else {
        tilt = true; piv = mxL; let mA = Math.PI / 2;
        for (let x = nx; x <= piv - 0.01; x += 0.01) {
            let h_at_x = 0; for (let b of bases) { if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) { if (b.alt > h_at_x) h_at_x = b.alt; } }
            let a = Math.atan2(maxH - h_at_x, piv - x); if (a < mA) mA = a;
        } ang = -mA * (180 / Math.PI);
    }
    let maxPontaH = maxH + nAlt;
    if (tilt) {
        let rad = ang * Math.PI / 180;
        if (ang > 0) maxPontaH = maxH + (piv - nx) * Math.sin(rad) + nAlt * Math.cos(rad);
        else maxPontaH = maxH + ((nx + nw) - piv) * Math.sin(Math.abs(rad)) + nAlt * Math.cos(Math.abs(rad));
    }
    if (maxPontaH > ALTURA_MAX) return { possivel: false };
    return { possivel: true, tilt, angulo: ang, hBase: maxH, pivotX: piv };
}

function adicionarNovoPalete() {
    const nome = document.getElementById('pNome').value || "P-" + (paletes.length + 1);
    const und = document.getElementById('unidadeMedida').value; let div = 1; if (und === 'cm') div = 100; if (und === 'mm') div = 1000;
    const comp = parseFloat(document.getElementById('pComprimento').value) / div;
    const larg = parseFloat(document.getElementById('pLargura').value) / div;
    const alt = parseFloat(document.getElementById('pAltura').value) / div;
    const peso = parseFloat(document.getElementById('pPeso').value);
    const zDesj = parseInt(document.getElementById('pNivelDesejado').value);
    const emp = document.getElementById('pEmpilhavel').checked;
    const cfg = containers[document.getElementById('tipoContainer').value];

    if (peso + paletes.reduce((s, p) => s + p.peso, 0) > cfg.pesoMax) return alert("Peso Máximo Excedido!");

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
    paletes.push(novo); renderizar(novo); processarCargas();
}

function renderizar(p) {
    const div = document.createElement('div'); div.className = `palete ${p.tilted ? 'tilted' : ''} ${p.emp ? 'empilhavel' : ''}`; div.id = p.id;
    div.style.width = (p.comp * ESCALA) + "px"; div.style.height = (p.larg * ESCALA) + "px"; div.style.left = (p.x * ESCALA) + "px"; div.style.top = (p.y * ESCALA) + "px";
    div.style.backgroundColor = p.z === 0 ? "var(--z0-color)" : "var(--z1-color)";
    if (p.tilted) div.style.transform = `perspective(500px) rotateY(${p.angulo / 2}deg)`;
    div.innerHTML = `<span class="btn-delete" onclick="remover('${p.id}')" style="position:absolute;top:2px;right:18px;cursor:pointer;background:rgba(0,0,0,0.4);border-radius:50%;width:16px;height:16px;line-height:14px;text-align:center;">×</span><span class="palete-title">${p.nome}</span>`;
    div.onmouseenter = (e) => mostrarTooltip(e, p); div.onmousemove = (e) => moverTooltip(e); div.onmouseleave = () => esconderTooltip();
    document.getElementById('container-floor').appendChild(div); tornarArrastavel(div, p); filtrarNivel(nivelVisivel);
}

function tornarArrastavel(elm, obj) {
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
        let nx = (elm.offsetLeft - p1) / ESCALA, ny = (elm.offsetTop - p2) / ESCALA; const cfg = containers[document.getElementById('tipoContainer').value];
        nx = Math.max(0, Math.min(nx, cfg.comprimento - obj.comp));
        ny = Math.max(0, Math.min(ny, cfg.largura - obj.larg));
        elm.style.left = (nx * ESCALA) + "px"; elm.style.top = (ny * ESCALA) + "px"; obj.x = nx; obj.y = ny;
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
        elm.style.left = (obj.x * ESCALA) + "px"; elm.style.top = (obj.y * ESCALA) + "px";
        elm.className = `palete ${obj.tilted ? 'tilted' : ''} ${obj.emp ? 'empilhavel' : ''}`; elm.style.transform = obj.tilted ? `perspective(500px) rotateY(${obj.angulo / 2}deg)` : 'none'; processarCargas();
    }
    elm.onmousedown = iniciarArrasto; elm.ontouchstart = iniciarArrasto;
}

function buscarMelhorPosicao(obj) {
    const cfg = containers[document.getElementById('tipoContainer').value];
    for (let r = 0.05; r <= 0.8; r += 0.05) {
        for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 8) {
            let tx = obj.x + Math.cos(ang) * r, ty = obj.y + Math.sin(ang) * r;
            if (tx >= 0 && tx + obj.comp <= cfg.comprimento && ty >= 0 && ty + obj.larg <= cfg.largura) { if (!detectarColisao(obj.id, tx, ty, obj.comp, obj.larg, obj.z)) { if (obj.z === 0 || calcularAutoTilt(tx, ty, obj.comp, obj.larg, obj.alt)?.possivel) return { x: tx, y: ty }; } }
        }
    } return null;
}
function processarCargas() {
    const total = paletes.reduce((s, p) => s + (p.peso || 0), 0); const cfg = containers[document.getElementById('tipoContainer').value];
    document.getElementById('pesoDisplay').innerText = `${total} / ${cfg.pesoMax} kg`; document.getElementById('progressFill').style.width = (total / cfg.pesoMax * 100) + '%';
    const resDiv = document.getElementById('resultados');
    if (total === 0) { document.getElementById('cg-indicator-point').style.display = 'none'; resDiv.style.display = 'none'; renderSide(); atualizarTabelaImpressao(); return; }
    resDiv.style.display = 'block'; let mX = 0, mY = 0;
    paletes.forEach(p => { mX += p.peso * (p.x + p.comp / 2); mY += p.peso * (p.y + p.larg / 2); });
    const cgX = mX / total, cgY = mY / total, dx = cgX - (cfg.comprimento / 2), kgDeslocados = (Math.abs(dx) * total) / (cfg.comprimento / 2);
    const pt = document.getElementById('cg-indicator-point'); pt.style.display = 'block'; pt.style.left = (cgX * ESCALA) + "px"; pt.style.top = (cgY * ESCALA) + "px";
    document.getElementById('resPesoTotal').innerText = `Massa Bruta: ${total}kg`; document.getElementById('resDeslocamento').innerHTML = `Desvio Eixo X: ${Math.abs(dx).toFixed(2)}m (${dx > 0 ? 'Frente' : 'Fundo'})<br>Força de Alavanca: <b>${kgDeslocados.toFixed(0)}kg</b>`; document.getElementById('resSugestao').innerText = Math.abs(dx) > 0.3 ? `Alerta: Mova carga para o ${dx > 0 ? 'Fundo' : 'Frente'}.` : "Container Estável.";
    paletes.forEach(p => { const el = document.getElementById(p.id); if (p.z === 1) { const res = calcularAutoTilt(p.x, p.y, p.comp, p.larg, p.alt); if (res && res.tilt) { el.classList.add('tilted'); el.style.transform = `perspective(500px) rotateY(${res.angulo / 2}deg)`; } else { el.classList.remove('tilted'); el.style.transform = 'none'; } } });
    renderSide(); atualizarTabelaImpressao();
}
function renderSide() {
    const side = document.getElementById('side-view-container'), yAxis = side.querySelector('.y-axis');
    side.innerHTML = ''; if (yAxis) side.appendChild(yAxis);
    paletes.forEach(p => {
        const b = document.createElement('div'); b.className = 'side-palete-block'; b.style.width = (p.comp * ESCALA) + "px"; b.style.height = (p.alt * ESCALA) + "px"; b.style.left = (p.x * ESCALA) + "px"; let hBase = 0;
        if (p.z === 1) { const res = calcularAutoTilt(p.x, p.y, p.comp, p.larg, p.alt); if (res && res.possivel) { hBase = res.hBase; if (res.tilt) { let originX = (res.pivotX - p.x) * ESCALA; b.style.transformOrigin = `${originX}px bottom`; b.style.transform = `rotate(${res.angulo}deg)`; } else { b.style.transformOrigin = `center bottom`; b.style.transform = `none`; } } }
        b.style.bottom = (hBase * ESCALA) + "px"; b.style.backgroundColor = p.z === 0 ? "var(--z0-color)" : "var(--z1-color)"; side.appendChild(b);
    });
}
function filtrarNivel(z) { nivelVisivel = parseInt(z); paletes.forEach(p => { const el = document.getElementById(p.id); if (el) { el.style.opacity = (p.z === nivelVisivel) ? "1" : "0.15"; el.style.pointerEvents = (p.z === nivelVisivel) ? "all" : "none"; } }); }
function remover(id) { paletes = paletes.filter(p => p.id !== id); document.getElementById(id).remove(); processarCargas(); }
function mostrarFeedback(x, y) { const fb = document.getElementById('feedback-msg'); fb.style.left = (x - 60) + "px"; fb.style.top = (y - 40) + "px"; fb.style.display = 'block'; setTimeout(() => fb.style.display = 'none', 1500); }
function limparTudoComConfirmacao() { if (confirm("Deseja apagar todo o planejamento?")) mudarContainer(); }

// HOVER NO CONTAINER COM ID E DESCRIÇÃO
function mostrarTooltip(e, p) {
    const tt = document.getElementById('tooltip-info'); let html = `<strong>${p.nome}</strong><br>Peso Total: ${p.peso}kg | Dim: ${p.comp}x${p.larg}m<hr>`;
    if (p.itensInternos && p.itensInternos.length > 0) {
        p.itensInternos.forEach(i => {
            const dim = `${i.comp || 0}x${i.larg || 0}x${i.alt || 0}m`; const pos = `X:${i.x || 0}, Y:${i.y || 0}, Z:${i.z || 0}`;
            // Agora renderiza perfeitamente o ID e a Descrição salva!
            html += `• <b>[${i.id || 'S/ID'}]</b> ${i.desc || 'Sem desc.'} <br>  <span style="color:#94a3b8; font-size:10px; margin-left:10px;">Dim: ${dim} | Posição: ${pos}</span><br>`;
        });
    } else { html += "<em style='color:#94a3b8;'>Sem sub-itens desenhados</em>"; }
    tt.innerHTML = html; tt.style.display = 'block';
}
function moverTooltip(e) { const tt = document.getElementById('tooltip-info'); tt.style.left = (e.clientX + 15) + "px"; tt.style.top = (e.clientY + 15) + "px"; }
function esconderTooltip() { document.getElementById('tooltip-info').style.display = 'none'; }


/** =========================================================
 * MOTOR FÍSICO DO PALETE (WMS MICRO-LOCALIZAÇÃO)
 * ========================================================= */

function atualizarLabelsMedidaPalete() {
    const und = document.getElementById('unidadeMedidaPalete').value;
    document.getElementById('lblCaixaC').innerText = `C (${und})`; document.getElementById('lblCaixaL').innerText = `L (${und})`; document.getElementById('lblCaixaA').innerText = `A (${und})`;
    const step = und === 'm' ? '0.05' : (und === 'cm' ? '1' : '10');
    document.getElementById('addCaixaC').step = step; document.getElementById('addCaixaL').step = step; document.getElementById('addCaixaA').step = step;
    let f = 1; if (und === 'cm') f = 100; if (und === 'mm') f = 1000;
    document.getElementById('addCaixaC').value = (0.4 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('addCaixaL').value = (0.3 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('addCaixaA').value = (0.3 * f).toFixed(und === 'm' ? 2 : 0);
}

function abrirModalDetalhes(id) {
    paleteSendoEditado = paletes.find(p => p.id === id);
    document.getElementById('modalTitle').innerText = `Desenhando Palete: ${paleteSendoEditado.nome}`;
    document.getElementById('editPalletNome').value = paleteSendoEditado.nome;
    document.getElementById('editPalletPeso').value = paleteSendoEditado.peso;
    document.getElementById('editPalletComp').value = paleteSendoEditado.comp;
    document.getElementById('editPalletLarg').value = paleteSendoEditado.larg;
    document.getElementById('editPalletAlt').value = paleteSendoEditado.alt;

    itensPaleteEditado = paleteSendoEditado.itensInternos ? [...paleteSendoEditado.itensInternos] : [];
    nivelVisivelPalete = 0; document.getElementById('viewNivelPalete').value = 0;

    atualizarAreaPalete();
    document.getElementById('modalDetalhes').style.display = 'block';
}

function atualizarAreaPalete() {
    const compP = parseFloat(document.getElementById('editPalletComp').value) || 1.2;
    const largP = parseFloat(document.getElementById('editPalletLarg').value) || 1.0;
    const altP = parseFloat(document.getElementById('editPalletAlt').value) || 1.1;

    ESCALA_PALETE = 350 / Math.max(compP, largP);

    const floor = document.getElementById('pallet-floor');
    floor.innerHTML = '';
    floor.style.width = (compP * ESCALA_PALETE) + 'px';
    floor.style.height = (largP * ESCALA_PALETE) + 'px';

    const side = document.getElementById('pallet-side-view');
    side.style.width = floor.style.width;
    side.style.height = (altP * ESCALA_PALETE) + 'px';

    atualizarListaMiniItens();
    itensPaleteEditado.forEach(item => renderizarCaixaNoPalete(item));
    processarCargasPalete();
}

// ATUALIZAÇÃO: Lista com Descrição
function atualizarListaMiniItens() {
    const list = document.getElementById('listaItensInternos');
    list.innerHTML = '';
    itensPaleteEditado.forEach(item => {
        const row = document.createElement('div'); row.className = 'mini-item-row';
        row.innerHTML = `<span>[${item.id}] ${item.desc || 'Caixa'} (Z:${item.z})</span> <button onclick="removerCaixaPalete('${item.uuid}')">×</button>`;
        list.appendChild(row);
    });
}

function calcularTiltCaixa(nx, ny, ncomp, nlarg, nalt, nz) {
    const altMax = parseFloat(document.getElementById('editPalletAlt').value) || 1.1;
    const EPSILON = 0.005;

    if (nz === 0) {
        if (nalt > altMax + EPSILON) return { possivel: false };
        return { possivel: true, tilt: false, angulo: 0, hBase: 0, pivotX: nx };
    }

    const bases = itensPaleteEditado.filter(i => i.z === nz - 1 && !(nx + ncomp <= i.x + EPSILON || nx >= i.x + i.comp - EPSILON || ny + nlarg <= i.y + EPSILON || ny >= i.y + i.larg - EPSILON));
    if (bases.length === 0) return { possivel: false };

    let areaApoiada = 0;
    bases.forEach(b => { areaApoiada += (Math.max(0, Math.min(nx + ncomp, b.x + b.comp) - Math.max(nx, b.x)) * Math.max(0, Math.min(ny + nlarg, b.y + b.larg) - Math.max(ny, b.y))); });
    if ((areaApoiada / (ncomp * nlarg)) < (1 - OVERHANG_MAX)) return { possivel: false };

    let maxH = -1, mxL = nx + ncomp, mxR = nx;
    for (let x = nx; x <= nx + ncomp + 0.001; x += 0.01) {
        let h_at_x = 0;
        for (let b of bases) { if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) { let absH = (b._absHeight || 0) + b.alt; if (absH > h_at_x) h_at_x = absH; } }
        if (h_at_x > maxH) { maxH = h_at_x; mxL = x; mxR = x; } else if (Math.abs(h_at_x - maxH) < 0.001) { if (x < mxL) mxL = x; if (x > mxR) mxR = x; }
    }

    let cx = nx + ncomp / 2, tilt = false, ang = 0, piv = nx;
    if (cx >= mxL && cx <= mxR) { tilt = false; piv = nx; ang = 0; }
    else if (cx > mxR) {
        tilt = true; piv = mxR; let mA = Math.PI / 2;
        for (let x = piv + 0.01; x <= nx + ncomp + 0.001; x += 0.01) {
            let h_at_x = 0; for (let b of bases) { if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) { let absH = (b._absHeight || 0) + b.alt; if (absH > h_at_x) h_at_x = absH; } }
            let a = Math.atan2(maxH - h_at_x, x - piv); if (a < mA) mA = a;
        } ang = mA * (180 / Math.PI);
    } else {
        tilt = true; piv = mxL; let mA = Math.PI / 2;
        for (let x = nx; x <= piv - 0.01; x += 0.01) {
            let h_at_x = 0; for (let b of bases) { if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) { let absH = (b._absHeight || 0) + b.alt; if (absH > h_at_x) h_at_x = absH; } }
            let a = Math.atan2(maxH - h_at_x, piv - x); if (a < mA) mA = a;
        } ang = -mA * (180 / Math.PI);
    }

    let maxPontaH = maxH + nalt;
    if (tilt) {
        let rad = ang * Math.PI / 180;
        if (ang > 0) maxPontaH = maxH + (piv - nx) * Math.sin(rad) + nalt * Math.cos(rad);
        else maxPontaH = maxH + ((nx + ncomp) - piv) * Math.sin(Math.abs(rad)) + nalt * Math.cos(Math.abs(rad));
    }
    if (maxPontaH > altMax + EPSILON) return { possivel: false };
    return { possivel: true, tilt, angulo: ang, hBase: maxH, pivotX: piv };
}

// ATUALIZAÇÃO: Captura da Descrição do Item
function adicionarCaixaNoPalete() {
    const id = document.getElementById('addCaixaId').value || "CX-" + (itensPaleteEditado.length + 1);
    const desc = document.getElementById('addCaixaDesc').value || "Caixa"; // Puxa do HTML

    const und = document.getElementById('unidadeMedidaPalete').value;
    let div = 1; if (und === 'cm') div = 100; if (und === 'mm') div = 1000;

    const comp = parseFloat(document.getElementById('addCaixaC').value) / div;
    const larg = parseFloat(document.getElementById('addCaixaL').value) / div;
    const alt = parseFloat(document.getElementById('addCaixaA').value) / div;
    const peso = parseFloat(document.getElementById('addCaixaP').value);
    const zDesj = parseInt(document.getElementById('addCaixaZ').value);

    const maxCompP = parseFloat(document.getElementById('editPalletComp').value) || 1.2;
    const maxLargP = parseFloat(document.getElementById('editPalletLarg').value) || 1.0;

    let ponto = null, infoTilt = null;
    for (let x = 0; x <= maxCompP - comp + 0.01; x += 0.05) {
        x = Math.round(x * 100) / 100;
        for (let y = 0; y <= maxLargP - larg + 0.01; y += 0.05) {
            y = Math.round(y * 100) / 100;
            if (!detectarColisao('', x, y, comp, larg, zDesj, itensPaleteEditado)) {
                const res = calcularTiltCaixa(x, y, comp, larg, alt, zDesj);
                if (res && res.possivel) { ponto = { x, y }; infoTilt = res; break; }
            }
        } if (ponto) break;
    }

    if (!ponto) {
        const fb = document.getElementById('feedback-pallet-msg'); fb.style.display = 'block'; setTimeout(() => fb.style.display = 'none', 2000);
        return;
    }

    const novaCaixa = {
        uuid: "cx_" + Date.now(), id, desc, comp, larg, alt, peso: peso,
        x: ponto.x, y: ponto.y, z: zDesj,
        tilted: infoTilt?.tilt || false, angulo: infoTilt?.angulo || 0
    };

    itensPaleteEditado.push(novaCaixa);
    renderizarCaixaNoPalete(novaCaixa);
    atualizarListaMiniItens();
    processarCargasPalete();
}

function renderizarCaixaNoPalete(item) {
    const div = document.createElement('div');
    div.className = `caixa-interna ${item.tilted ? 'tilted' : ''}`; div.id = item.uuid;
    div.style.width = (item.comp * ESCALA_PALETE) + "px"; div.style.height = (item.larg * ESCALA_PALETE) + "px";
    div.style.left = (item.x * ESCALA_PALETE) + "px"; div.style.top = (item.y * ESCALA_PALETE) + "px";

    const hue = (item.z * 60 + item.comp * 100) % 360;
    div.style.backgroundColor = `hsl(${hue}, 70%, 40%)`;
    div.style.zIndex = item.z + 10;

    if (item.tilted) div.style.transform = `perspective(500px) rotateY(${item.angulo / 2}deg)`;
    div.innerHTML = `<span style="pointer-events:none;">${item.id}</span>`;

    document.getElementById('pallet-floor').appendChild(div);
    tornarCaixaArrastavel(div, item);
    filtrarNivelPalete(nivelVisivelPalete);
}

function tornarCaixaArrastavel(elm, obj) {
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0, oldX = obj.x, oldY = obj.y;
    function iniciarArrasto(e) {
        oldX = obj.x; oldY = obj.y; elm.style.zIndex = 1000;
        const cX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX, cY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        p3 = cX; p4 = cY;
        if (e.type.includes('mouse')) { document.onmousemove = moverElemento; document.onmouseup = finalizarArrasto; }
        else { document.ontouchmove = moverElemento; document.ontouchend = finalizarArrasto; document.ontouchcancel = finalizarArrasto; }
    }
    function moverElemento(e) {
        const cX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX, cY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        p1 = p3 - cX; p2 = p4 - cY; p3 = cX; p4 = cY;

        let nx = (elm.offsetLeft - p1) / ESCALA_PALETE, ny = (elm.offsetTop - p2) / ESCALA_PALETE;
        const maxCompP = parseFloat(document.getElementById('editPalletComp').value) || 1.2;
        const maxLargP = parseFloat(document.getElementById('editPalletLarg').value) || 1.0;

        nx = Math.max(0, Math.min(nx, maxCompP - obj.comp));
        ny = Math.max(0, Math.min(ny, maxLargP - obj.larg));

        elm.style.left = (nx * ESCALA_PALETE) + "px"; elm.style.top = (ny * ESCALA_PALETE) + "px"; obj.x = nx; obj.y = ny;
    }
    function finalizarArrasto(e) {
        document.onmousemove = null; document.onmouseup = null; document.ontouchmove = null; document.ontouchend = null; document.ontouchcancel = null;
        elm.style.zIndex = obj.z + 10;

        const resTilt = calcularTiltCaixa(obj.x, obj.y, obj.comp, obj.larg, obj.alt, obj.z);
        const valid = resTilt.possivel && !detectarColisao(obj.uuid, obj.x, obj.y, obj.comp, obj.larg, obj.z, itensPaleteEditado);
        if (!valid) { obj.x = oldX; obj.y = oldY; }
        else { obj.tilted = resTilt.tilt; obj.angulo = resTilt.angulo; }

        elm.style.left = (obj.x * ESCALA_PALETE) + "px"; elm.style.top = (obj.y * ESCALA_PALETE) + "px";
        elm.className = `caixa-interna ${obj.tilted ? 'tilted' : ''}`; elm.style.transform = obj.tilted ? `perspective(500px) rotateY(${obj.angulo / 2}deg)` : 'none';
        processarCargasPalete();
    }
    elm.onmousedown = iniciarArrasto; elm.ontouchstart = iniciarArrasto;
}

function processarCargasPalete() {
    const side = document.getElementById('pallet-side-view');
    side.innerHTML = '';
    itensPaleteEditado.sort((a, b) => a.z - b.z);

    itensPaleteEditado.forEach(i => {
        let hBase = 0;
        if (i.z > 0) { const res = calcularTiltCaixa(i.x, i.y, i.comp, i.larg, i.alt, i.z); if (res.possivel) hBase = res.hBase; }
        i._absHeight = hBase;

        const b = document.createElement('div');
        b.className = 'side-palete-block';
        b.style.width = (i.comp * ESCALA_PALETE) + "px"; b.style.height = (i.alt * ESCALA_PALETE) + "px";
        b.style.left = (i.x * ESCALA_PALETE) + "px"; b.style.bottom = (hBase * ESCALA_PALETE) + "px";
        b.style.backgroundColor = document.getElementById(i.uuid) ? document.getElementById(i.uuid).style.backgroundColor : '#ff0000';

        if (i.tilted) {
            const res = calcularTiltCaixa(i.x, i.y, i.comp, i.larg, i.alt, i.z);
            if (res.possivel && res.tilt) {
                let originX = (res.pivotX - i.x) * ESCALA_PALETE;
                b.style.transformOrigin = `${originX}px bottom`;
                b.style.transform = `rotate(${res.angulo}deg)`;
            }
        }
        side.appendChild(b);
    });
}

function filtrarNivelPalete(z) {
    nivelVisivelPalete = parseInt(z);
    itensPaleteEditado.forEach(i => {
        const el = document.getElementById(i.uuid);
        if (el) { el.style.opacity = (i.z === nivelVisivelPalete) ? "1" : "0.1"; el.style.pointerEvents = (i.z === nivelVisivelPalete) ? "all" : "none"; }
    });
}

function removerCaixaPalete(uuid) { itensPaleteEditado = itensPaleteEditado.filter(i => i.uuid !== uuid); const el = document.getElementById(uuid); if (el) el.remove(); atualizarListaMiniItens(); processarCargasPalete(); }

function salvarDetalhesPalete() {
    paleteSendoEditado.nome = document.getElementById('editPalletNome').value;
    paleteSendoEditado.peso = parseFloat(document.getElementById('editPalletPeso').value) || 0;
    paleteSendoEditado.comp = parseFloat(document.getElementById('editPalletComp').value) || 1.2;
    paleteSendoEditado.larg = parseFloat(document.getElementById('editPalletLarg').value) || 1.0;
    paleteSendoEditado.alt = parseFloat(document.getElementById('editPalletAlt').value) || 1.1;

    const el = document.getElementById(paleteSendoEditado.id);
    if (el) { el.style.width = (paleteSendoEditado.comp * ESCALA) + "px"; el.style.height = (paleteSendoEditado.larg * ESCALA) + "px"; el.querySelector('.palete-title').innerText = paleteSendoEditado.nome; }

    paleteSendoEditado.itensInternos = [...itensPaleteEditado];
    document.getElementById('modalDetalhes').style.display = 'none'; paleteSendoEditado = null;
    processarCargas();
}
function fecharModal() { document.getElementById('modalDetalhes').style.display = 'none'; paleteSendoEditado = null; }

/** IMPORTAÇÃO / EXPORTAÇÃO JSON & IMPRESSÃO **/
function exportarLayout() {
    if (paletes.length === 0) return alert("Não há carga para salvar.");
    const blob = new Blob([JSON.stringify({ container: document.getElementById('tipoContainer').value, paletes }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `layout_logisim_${Date.now()}.json`; link.click();
}

function importarLayout(event) {
    const arquivo = event.target.files[0]; if (!arquivo) return; const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const dados = JSON.parse(e.target.result); document.getElementById('tipoContainer').value = dados.container || "20"; limparContainer();
            dados.paletes.forEach(p => { const novo = { ...p, id: "p_" + Math.random().toString(36).substr(2, 9), itensInternos: p.itensInternos || [] }; paletes.push(novo); renderizar(novo); });
            processarCargas(); alert("Layout carregado com sucesso!");
        } catch (err) { alert("Erro ao carregar o arquivo JSON."); }
    }; reader.readAsText(arquivo); event.target.value = '';
}

function atualizarTabelaImpressao() {
    document.getElementById('print-date').innerText = new Date().toLocaleString(); const tbody = document.querySelector('#lista-paletes-print tbody'); tbody.innerHTML = '';
    paletes.forEach(p => {
        let itensTexto = p.itensInternos && p.itensInternos.length > 0 ? p.itensInternos.map(i => `${i.id} - ${i.desc} (Pos: ${i.x.toFixed(2)}, ${i.y.toFixed(2)}, Z:${i.z})`).join('<br>') : "Palete Fechado";
        const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${p.nome}</strong></td><td>${itensTexto}</td><td>Z:${p.z}</td><td>${p.peso}</td><td>${p.comp}x${p.larg}x${p.alt}</td><td>(${p.x.toFixed(2)}, ${p.y.toFixed(2)})</td>`; tbody.appendChild(tr);
    });
}
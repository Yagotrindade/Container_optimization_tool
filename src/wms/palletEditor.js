import { state } from '../store/state.js';
import { detectarColisao } from '../core/physics.js';
import { processarCargas } from '../core/container.js';

export function atualizarLabelsMedidaPalete() {
    const und = document.getElementById('unidadeMedidaPalete').value;
    document.getElementById('lblCaixaC').innerText = `C (${und})`; document.getElementById('lblCaixaL').innerText = `L (${und})`; document.getElementById('lblCaixaA').innerText = `A (${und})`;
    const step = und === 'm' ? '0.05' : (und === 'cm' ? '1' : '10');
    document.getElementById('addCaixaC').step = step; document.getElementById('addCaixaL').step = step; document.getElementById('addCaixaA').step = step;
    let f = 1; if (und === 'cm') f = 100; if (und === 'mm') f = 1000;
    document.getElementById('addCaixaC').value = (0.4 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('addCaixaL').value = (0.3 * f).toFixed(und === 'm' ? 2 : 0); document.getElementById('addCaixaA').value = (0.3 * f).toFixed(und === 'm' ? 2 : 0);
}

export function abrirModalDetalhes(id) {
    state.paleteSendoEditado = state.paletes.find(p => p.id === id);
    document.getElementById('modalTitle').innerText = `Desenhando Palete: ${state.paleteSendoEditado.nome}`;
    document.getElementById('editPalletNome').value = state.paleteSendoEditado.nome;
    document.getElementById('editPalletPeso').value = state.paleteSendoEditado.peso;
    document.getElementById('editPalletComp').value = state.paleteSendoEditado.comp;
    document.getElementById('editPalletLarg').value = state.paleteSendoEditado.larg;
    document.getElementById('editPalletAlt').value = state.paleteSendoEditado.alt;

    state.itensPaleteEditado = state.paleteSendoEditado.itensInternos ? [...state.paleteSendoEditado.itensInternos] : [];
    state.nivelVisivelPalete = 0; document.getElementById('viewNivelPalete').value = 0;

    atualizarAreaPalete();
    document.getElementById('modalDetalhes').style.display = 'block';
}

export function atualizarAreaPalete() {
    const compP = parseFloat(document.getElementById('editPalletComp').value) || 1.2;
    const largP = parseFloat(document.getElementById('editPalletLarg').value) || 1.0;
    const altP = parseFloat(document.getElementById('editPalletAlt').value) || 1.1;

    state.ESCALA_PALETE = 350 / Math.max(compP, largP);

    const floor = document.getElementById('pallet-floor');
    floor.innerHTML = '';
    floor.style.width = (compP * state.ESCALA_PALETE) + 'px';
    floor.style.height = (largP * state.ESCALA_PALETE) + 'px';

    const side = document.getElementById('pallet-side-view');
    side.style.width = floor.style.width;
    side.style.height = (altP * state.ESCALA_PALETE) + 'px';

    atualizarListaMiniItens();
    state.itensPaleteEditado.forEach(item => renderizarCaixaNoPalete(item));
    processarCargasPalete();
}

export function atualizarListaMiniItens() {
    const list = document.getElementById('listaItensInternos');
    list.innerHTML = '';
    state.itensPaleteEditado.forEach(item => {
        const row = document.createElement('div'); row.className = 'mini-item-row';
        row.innerHTML = `<span>[${item.id}] ${item.desc || 'Caixa'} (Z:${item.z})</span> <button onclick="removerCaixaPalete('${item.uuid}')">×</button>`;
        list.appendChild(row);
    });
}

export function calcularTiltCaixa(nx, ny, ncomp, nlarg, nalt, nz) {
    const altMax = parseFloat(document.getElementById('editPalletAlt').value) || 1.1;
    const EPSILON = 0.005;

    if (nz === 0) {
        if (nalt > altMax + EPSILON) return { possivel: false };
        return { possivel: true, tilt: false, angulo: 0, hBase: 0, pivotX: nx };
    }

    const bases = state.itensPaleteEditado.filter(i => i.z === nz - 1 && !(nx + ncomp <= i.x + EPSILON || nx >= i.x + i.comp - EPSILON || ny + nlarg <= i.y + EPSILON || ny >= i.y + i.larg - EPSILON));
    if (bases.length === 0) return { possivel: false };

    let areaApoiada = 0;
    bases.forEach(b => { areaApoiada += (Math.max(0, Math.min(nx + ncomp, b.x + b.comp) - Math.max(nx, b.x)) * Math.max(0, Math.min(ny + nlarg, b.y + b.larg) - Math.max(ny, b.y))); });
    if ((areaApoiada / (ncomp * nlarg)) < (1 - state.OVERHANG_MAX)) return { possivel: false };

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

export function adicionarCaixaNoPalete() {
    const id = document.getElementById('addCaixaId').value || "CX-" + (state.itensPaleteEditado.length + 1);
    const desc = document.getElementById('addCaixaDesc').value || "Caixa";

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
            if (!detectarColisao('', x, y, comp, larg, zDesj, state.itensPaleteEditado)) {
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

    state.itensPaleteEditado.push(novaCaixa);
    renderizarCaixaNoPalete(novaCaixa);
    atualizarListaMiniItens();
    processarCargasPalete();
}

export function renderizarCaixaNoPalete(item) {
    const div = document.createElement('div');
    div.className = `caixa-interna ${item.tilted ? 'tilted' : ''}`; div.id = item.uuid;
    div.style.width = (item.comp * state.ESCALA_PALETE) + "px"; div.style.height = (item.larg * state.ESCALA_PALETE) + "px";
    div.style.left = (item.x * state.ESCALA_PALETE) + "px"; div.style.top = (item.y * state.ESCALA_PALETE) + "px";

    const hue = (item.z * 60 + item.comp * 100) % 360;
    div.style.backgroundColor = `hsl(${hue}, 70%, 40%)`;
    div.style.zIndex = item.z + 10;

    if (item.tilted) div.style.transform = `perspective(500px) rotateY(${item.angulo / 2}deg)`;
    div.innerHTML = `<span style="pointer-events:none;">${item.id}</span>`;

    document.getElementById('pallet-floor').appendChild(div);
    tornarCaixaArrastavel(div, item);
    filtrarNivelPalete(state.nivelVisivelPalete);
}

export function tornarCaixaArrastavel(elm, obj) {
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

        let nx = (elm.offsetLeft - p1) / state.ESCALA_PALETE, ny = (elm.offsetTop - p2) / state.ESCALA_PALETE;
        const maxCompP = parseFloat(document.getElementById('editPalletComp').value) || 1.2;
        const maxLargP = parseFloat(document.getElementById('editPalletLarg').value) || 1.0;

        nx = Math.max(0, Math.min(nx, maxCompP - obj.comp));
        ny = Math.max(0, Math.min(ny, maxLargP - obj.larg));

        elm.style.left = (nx * state.ESCALA_PALETE) + "px"; elm.style.top = (ny * state.ESCALA_PALETE) + "px"; obj.x = nx; obj.y = ny;
    }
    function finalizarArrasto(e) {
        document.onmousemove = null; document.onmouseup = null; document.ontouchmove = null; document.ontouchend = null; document.ontouchcancel = null;
        elm.style.zIndex = obj.z + 10;

        const resTilt = calcularTiltCaixa(obj.x, obj.y, obj.comp, obj.larg, obj.alt, obj.z);
        const valid = resTilt.possivel && !detectarColisao(obj.uuid, obj.x, obj.y, obj.comp, obj.larg, obj.z, state.itensPaleteEditado);
        if (!valid) { obj.x = oldX; obj.y = oldY; }
        else { obj.tilted = resTilt.tilt; obj.angulo = resTilt.angulo; }

        elm.style.left = (obj.x * state.ESCALA_PALETE) + "px"; elm.style.top = (obj.y * state.ESCALA_PALETE) + "px";
        elm.className = `caixa-interna ${obj.tilted ? 'tilted' : ''}`; elm.style.transform = obj.tilted ? `perspective(500px) rotateY(${obj.angulo / 2}deg)` : 'none';
        processarCargasPalete();
    }
    elm.onmousedown = iniciarArrasto; elm.ontouchstart = iniciarArrasto;
}

export function processarCargasPalete() {
    const side = document.getElementById('pallet-side-view');
    side.innerHTML = '';
    state.itensPaleteEditado.sort((a, b) => a.z - b.z);

    state.itensPaleteEditado.forEach(i => {
        let hBase = 0;
        if (i.z > 0) { const res = calcularTiltCaixa(i.x, i.y, i.comp, i.larg, i.alt, i.z); if (res.possivel) hBase = res.hBase; }
        i._absHeight = hBase;

        const b = document.createElement('div');
        b.className = 'side-palete-block';
        b.style.width = (i.comp * state.ESCALA_PALETE) + "px"; b.style.height = (i.alt * state.ESCALA_PALETE) + "px";
        b.style.left = (i.x * state.ESCALA_PALETE) + "px"; b.style.bottom = (hBase * state.ESCALA_PALETE) + "px";
        b.style.backgroundColor = document.getElementById(i.uuid) ? document.getElementById(i.uuid).style.backgroundColor : '#ff0000';

        if (i.tilted) {
            const res = calcularTiltCaixa(i.x, i.y, i.comp, i.larg, i.alt, i.z);
            if (res.possivel && res.tilt) {
                let originX = (res.pivotX - i.x) * state.ESCALA_PALETE;
                b.style.transformOrigin = `${originX}px bottom`;
                b.style.transform = `rotate(${res.angulo}deg)`;
            }
        }
        side.appendChild(b);
    });
}

export function filtrarNivelPalete(z) {
    state.nivelVisivelPalete = parseInt(z);
    state.itensPaleteEditado.forEach(i => {
        const el = document.getElementById(i.uuid);
        if (el) { el.style.opacity = (i.z === state.nivelVisivelPalete) ? "1" : "0.1"; el.style.pointerEvents = (i.z === state.nivelVisivelPalete) ? "all" : "none"; }
    });
}

export function removerCaixaPalete(uuid) { state.itensPaleteEditado = state.itensPaleteEditado.filter(i => i.uuid !== uuid); const el = document.getElementById(uuid); if (el) el.remove(); atualizarListaMiniItens(); processarCargasPalete(); }

export function salvarDetalhesPalete() {
    state.paleteSendoEditado.nome = document.getElementById('editPalletNome').value;
    state.paleteSendoEditado.peso = parseFloat(document.getElementById('editPalletPeso').value) || 0;
    state.paleteSendoEditado.comp = parseFloat(document.getElementById('editPalletComp').value) || 1.2;
    state.paleteSendoEditado.larg = parseFloat(document.getElementById('editPalletLarg').value) || 1.0;
    state.paleteSendoEditado.alt = parseFloat(document.getElementById('editPalletAlt').value) || 1.1;

    const el = document.getElementById(state.paleteSendoEditado.id);
    if (el) { el.style.width = (state.paleteSendoEditado.comp * state.ESCALA) + "px"; el.style.height = (state.paleteSendoEditado.larg * state.ESCALA) + "px"; el.querySelector('.palete-title').innerText = state.paleteSendoEditado.nome; }

    state.paleteSendoEditado.itensInternos = [...state.itensPaleteEditado];
    document.getElementById('modalDetalhes').style.display = 'none'; state.paleteSendoEditado = null;
    processarCargas();
}

export function fecharModal() {
    document.getElementById('modalDetalhes').style.display = 'none';
    state.paleteSendoEditado = null;
}
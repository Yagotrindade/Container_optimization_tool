import { state } from '../store/state.js';

export function detectarColisao(uniqueId, nx, ny, nw, nh, nz, array = state.paletes) {
    const EPSILON = 0.005;
    return array.some(p => (p.uuid || p.id) !== uniqueId && p.z === nz &&
        !(nx + nw <= p.x + EPSILON || nx >= p.x + p.comp - EPSILON ||
            ny + nh <= p.y + EPSILON || ny >= p.y + p.larg - EPSILON));
}

export function calcularAutoTilt(nx, ny, nw, nh, nAlt) {
    const bases = state.paletes.filter(p => p.z === 0 && p.emp && !(nx + nw <= p.x || nx >= p.x + p.comp || ny + nh <= p.y || ny >= p.y + p.larg));
    if (bases.length === 0) return { possivel: false };
    let area = 0; bases.forEach(b => { area += (Math.max(0, Math.min(nx + nw, b.x + b.comp) - Math.max(nx, b.x)) * Math.max(0, Math.min(ny + nh, b.y + b.larg) - Math.max(ny, b.y))); });
    if ((area / (nw * nh)) < (1 - state.OVERHANG_MAX)) return { possivel: false };
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
    if (maxPontaH > state.ALTURA_MAX) return { possivel: false };
    return { possivel: true, tilt, angulo: ang, hBase: maxH, pivotX: piv };
}

export function buscarMelhorPosicao(obj) {
    const cfg = state.containers[document.getElementById('tipoContainer').value];
    for (let r = 0.05; r <= 0.8; r += 0.05) {
        for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 8) {
            let tx = obj.x + Math.cos(ang) * r, ty = obj.y + Math.sin(ang) * r;
            if (tx >= 0 && tx + obj.comp <= cfg.comprimento && ty >= 0 && ty + obj.larg <= cfg.largura) { if (!detectarColisao(obj.id, tx, ty, obj.comp, obj.larg, obj.z)) { if (obj.z === 0 || calcularAutoTilt(tx, ty, obj.comp, obj.larg, obj.alt)?.possivel) return { x: tx, y: ty }; } }
        }
    } return null;
}
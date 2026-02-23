const ESCALA = 60;
const ALTURA_MAX = 2.39;
const OVERHANG_MAX = 0.10; // Tolerância de transbordo (10%)
let paletes = [];
let paleteSendoEditado = null;
let nivelVisivel = 0;

const containers = {
    "20": { largura: 2.35, comprimento: 5.9, pesoMax: 28000 },
    "40": { largura: 2.35, comprimento: 12.0, pesoMax: 30000 }
};

window.onload = () => mudarContainer();

function mudarContainer() { limparContainer(); }

function limparContainer() {
    paletes = [];
    const tipo = document.getElementById('tipoContainer').value;
    const config = containers[tipo];
    const floor = document.getElementById('container-floor');

    floor.innerHTML = '<div id="cg-indicator-point"></div><div id="feedback-msg">ESPAÇO INDISPONÍVEL</div>';
    floor.style.width = (config.comprimento * ESCALA) + 'px';
    floor.style.height = (config.largura * ESCALA) + 'px';

    document.getElementById('pesoDisplay').innerText = `0 / ${config.pesoMax} kg`;
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('resultados').style.display = 'none';

    const side = document.getElementById('side-view-container');
    side.style.width = floor.style.width;
    side.style.height = (ALTURA_MAX * ESCALA) + 'px';

    renderSide();
}

/** * NOVO MOTOR FÍSICO DE AUTO-TILT E COLISÃO
 * Simula Centro de Gravidade e Pivot de Rotação Rígida
 */
function calcularAutoTilt(nx, ny, nw, nh, nAlt) {
    const bases = paletes.filter(p => p.z === 0 && p.emp &&
        !(nx + nw <= p.x || nx >= p.x + p.comp || ny + nh <= p.y || ny >= p.y + p.larg));

    if (bases.length === 0) return { possivel: false };

    // 1. Validação de Área de Apoio (Overhang)
    let areaApoiada = 0;
    bases.forEach(b => {
        const xOverlap = Math.max(0, Math.min(nx + nw, b.x + b.comp) - Math.max(nx, b.x));
        const yOverlap = Math.max(0, Math.min(ny + nh, b.y + b.larg) - Math.max(ny, b.y));
        areaApoiada += (xOverlap * yOverlap);
    });
    if ((areaApoiada / (nw * nh)) < (1 - OVERHANG_MAX)) return { possivel: false };

    // 2. Mapeamento do Terreno e Plataforma Mais Alta
    let maxH = -1;
    let maxH_LeftX = nx + nw;
    let maxH_RightX = nx;

    // Varredura de 1 em 1 cm sob o palete
    for (let x = nx; x <= nx + nw + 0.001; x += 0.01) {
        let h_at_x = 0;
        for (let b of bases) {
            if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) {
                if (b.alt > h_at_x) h_at_x = b.alt;
            }
        }
        if (h_at_x > maxH) {
            maxH = h_at_x;
            maxH_LeftX = x;
            maxH_RightX = x;
        } else if (Math.abs(h_at_x - maxH) < 0.001) {
            if (x < maxH_LeftX) maxH_LeftX = x;
            if (x > maxH_RightX) maxH_RightX = x;
        }
    }

    // 3. Simulação de Tombamento por Centro de Gravidade (CG)
    let cx = nx + nw / 2; // Posição X do CG do palete
    let tilt = false;
    let angulo = 0;
    let pivotX = nx;

    if (cx >= maxH_LeftX && cx <= maxH_RightX) {
        // Estável: O CG está em cima da plataforma mais alta
        tilt = false;
        pivotX = nx;
        angulo = 0;
    }
    else if (cx > maxH_RightX) {
        // Tomba para a DIREITA
        tilt = true;
        pivotX = maxH_RightX;
        let minAngle = Math.PI / 2; // Máximo 90º

        // Procura o primeiro obstáculo que a base do palete vai bater
        for (let x = pivotX + 0.01; x <= nx + nw + 0.001; x += 0.01) {
            let h_at_x = 0;
            for (let b of bases) {
                if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) {
                    if (b.alt > h_at_x) h_at_x = b.alt;
                }
            }
            let dx = x - pivotX;
            let dy = maxH - h_at_x;
            let a = Math.atan2(dy, dx);
            if (a < minAngle) minAngle = a;
        }
        angulo = minAngle * (180 / Math.PI); // Ângulo Positivo (Horário)
    }
    else if (cx < maxH_LeftX) {
        // Tomba para a ESQUERDA
        tilt = true;
        pivotX = maxH_LeftX;
        let minAngle = Math.PI / 2;

        for (let x = nx; x <= pivotX - 0.01; x += 0.01) {
            let h_at_x = 0;
            for (let b of bases) {
                if (x >= b.x - 0.005 && x <= b.x + b.comp + 0.005) {
                    if (b.alt > h_at_x) h_at_x = b.alt;
                }
            }
            let dx = pivotX - x;
            let dy = maxH - h_at_x;
            let a = Math.atan2(dy, dx);
            if (a < minAngle) minAngle = a;
        }
        angulo = -minAngle * (180 / Math.PI); // Ângulo Negativo (Anti-horário)
    }

    // 4. Verificação de Teto (Não pode cruzar 2.39m)
    let L1 = pivotX - nx;
    let L2 = (nx + nw) - pivotX;
    let maxPontaH = maxH + nAlt;

    if (tilt) {
        let rad = angulo * Math.PI / 180;
        if (angulo > 0) {
            maxPontaH = maxH + L1 * Math.sin(rad) + nAlt * Math.cos(rad);
        } else {
            maxPontaH = maxH + L2 * Math.sin(Math.abs(rad)) + nAlt * Math.cos(Math.abs(rad));
        }
    }

    if (maxPontaH > ALTURA_MAX) return { possivel: false };

    return { possivel: true, tilt, angulo, hBase: maxH, pivotX };
}

function detectarColisao(id, nx, ny, nw, nh, nz) {
    return paletes.some(p => p.id !== id && p.z === nz && !(nx + nw <= p.x || nx >= p.x + p.comp || ny + nh <= p.y || ny >= p.y + p.larg));
}

/** INTERAÇÃO E RENDERIZAÇÃO DO DOM **/
function adicionarNovoPalete() {
    const nome = document.getElementById('pNome').value || "P-" + (paletes.length + 1);
    
    // Captura a unidade e define o divisor para converter para Metros (m)
    const und = document.getElementById('unidadeMedida').value;
    let divisor = 1;
    if (und === 'cm') divisor = 100;
    if (und === 'mm') divisor = 1000;

    // As dimensões agora são divididas pelo divisor para sempre entrar na lógica em Metros
    const comp = parseFloat(document.getElementById('pComprimento').value) / divisor;
    const larg = parseFloat(document.getElementById('pLargura').value) / divisor;
    const alt = parseFloat(document.getElementById('pAltura').value) / divisor;
    
    const peso = parseFloat(document.getElementById('pPeso').value);
    const zDesj = parseInt(document.getElementById('pNivelDesejado').value);
    const emp = document.getElementById('pEmpilhavel').checked;
    const config = containers[document.getElementById('tipoContainer').value];

    // ... Restante da função continua EXATAMENTE igual ...
    if (peso + paletes.reduce((s, p) => s + p.peso, 0) > config.pesoMax) return alert("Peso Máximo Excedido!");

    let ponto = null, infoTilt = null;
    for (let x = 0; x <= config.comprimento - comp; x += 0.05) {
        for (let y = 0; y <= config.largura - larg; y += 0.05) {
            if (!detectarColisao(null, x, y, comp, larg, zDesj)) {
                if (zDesj === 0) { ponto = { x, y }; break; }
                else {
                    const res = calcularAutoTilt(x, y, comp, larg, alt);
                    if (res && res.possivel) { ponto = { x, y }; infoTilt = res; break; }
                }
            }
        }
        if (ponto) break;
    }

    if (!ponto) return alert("Sem espaço disponível!");

    const novo = {
        id: "p_" + Date.now(), nome, comp, larg, alt, peso, emp,
        x: ponto.x, y: ponto.y, z: zDesj, itensInternos: []
    };

    paletes.push(novo);
    renderizar(novo);
    processarCargas();
}

function renderizar(p) {
    const div = document.createElement('div');
    div.className = `palete ${p.emp ? 'empilhavel' : ''}`;
    div.id = p.id;
    div.style.width = (p.comp * ESCALA) + "px";
    div.style.height = (p.larg * ESCALA) + "px";
    div.style.left = (p.x * ESCALA) + "px";
    div.style.top = (p.y * ESCALA) + "px";
    div.style.backgroundColor = p.z === 0 ? "var(--z0-color)" : "var(--z1-color)";

    // Atualização visual do Top View (Apenas estética)
    if (p.z === 1) {
        const res = calcularAutoTilt(p.x, p.y, p.comp, p.larg, p.alt);
        if (res && res.tilt) {
            div.classList.add('tilted');
            div.style.transform = `perspective(500px) rotateY(${res.angulo / 2}deg)`;
        }
    }

    div.innerHTML = `<span class="btn-delete" onclick="remover('${p.id}')" style="position:absolute;top:2px;right:18px;cursor:pointer;background:rgba(0,0,0,0.4);border-radius:50%;width:16px;height:16px;line-height:14px;text-align:center;">×</span>${p.nome}`;

    div.ondblclick = (e) => { e.stopPropagation(); abrirModalDetalhes(p.id); };
    div.onmouseenter = (e) => mostrarTooltip(e, p);
    div.onmousemove = (e) => moverTooltip(e);
    div.onmouseleave = () => esconderTooltip();

    document.getElementById('container-floor').appendChild(div);
    tornarArrastavel(div, p);
    filtrarNivel(nivelVisivel);
}

function tornarArrastavel(elm, obj) {
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0, oldX = obj.x, oldY = obj.y;
    let ultimoToque = 0; // Controle para o Double Tap no Mobile

    function iniciarArrasto(e) {
        if (e.target.innerText === '×') return;
        
        // Verifica se é um Double Tap (toque duplo em menos de 300ms)
        if (e.type === 'touchstart') {
            const tempoAtual = new Date().getTime();
            const tamanhoToque = tempoAtual - ultimoToque;
            if (tamanhoToque < 300 && tamanhoToque > 0) {
                e.preventDefault();
                abrirModalDetalhes(obj.id);
                return;
            }
            ultimoToque = tempoAtual;
        }

        oldX = obj.x; oldY = obj.y;
        elm.style.zIndex = 1000;
        
        // Unifica coordenadas de Mouse e Touch
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        p3 = clientX; p4 = clientY;
        
        if (e.type.includes('mouse')) {
            document.onmousemove = moverElemento;
            document.onmouseup = finalizarArrasto;
        } else {
            document.ontouchmove = moverElemento;
            document.ontouchend = finalizarArrasto;
            document.ontouchcancel = finalizarArrasto;
        }
    }

    function moverElemento(e) {
        // Unifica coordenadas
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        p1 = p3 - clientX; p2 = p4 - clientY;
        p3 = clientX; p4 = clientY;
        
        let nx = (elm.offsetLeft - p1) / ESCALA;
        let ny = (elm.offsetTop - p2) / ESCALA;
        const cfg = containers[document.getElementById('tipoContainer').value];
        
        if (nx >= 0 && nx + obj.comp <= cfg.comprimento && ny >= 0 && ny + obj.larg <= cfg.largura) {
            elm.style.left = (nx * ESCALA) + "px"; 
            elm.style.top = (ny * ESCALA) + "px";
            obj.x = nx; obj.y = ny;
        }
    }

    function finalizarArrasto(e) {
        document.onmousemove = null;
        document.onmouseup = null;
        document.ontouchmove = null;
        document.ontouchend = null;
        document.ontouchcancel = null;

        elm.style.zIndex = obj.z + 10;
        const resTilt = obj.z === 1 ? calcularAutoTilt(obj.x, obj.y, obj.comp, obj.larg, obj.alt) : { possivel: true };
        const valid = resTilt?.possivel && !detectarColisao(obj.id, obj.x, obj.y, obj.comp, obj.larg, obj.z);
        
        if (!valid) {
            const melhor = buscarMelhorPosicao(obj);
            if (melhor) { 
                obj.x = melhor.x; obj.y = melhor.y; 
                if(obj.z === 1) {
                    const nt = calcularAutoTilt(obj.x, obj.y, obj.comp, obj.larg, obj.alt);
                    obj.tilted = nt?.tilt || false; obj.angulo = nt?.angulo || 0;
                }
            } else { 
                obj.x = oldX; obj.y = oldY; 
                
                // Fallback de coordenadas para exibir o feedback no lugar certo (Mouse vs Touch)
                let feedX = window.innerWidth / 2;
                let feedY = window.innerHeight / 2;
                if (e.type.includes('mouse')) {
                    feedX = e.clientX; feedY = e.clientY;
                } else if (e.changedTouches && e.changedTouches.length > 0) {
                    feedX = e.changedTouches[0].clientX; feedY = e.changedTouches[0].clientY;
                }
                mostrarFeedback(feedX, feedY); 
            }
        } else if (obj.z === 1) {
            obj.tilted = resTilt.tilt; obj.angulo = resTilt.angulo;
        }
        
        elm.style.left = (obj.x * ESCALA) + "px"; elm.style.top = (obj.y * ESCALA) + "px";
        elm.className = `palete ${obj.tilted ? 'tilted' : ''} ${obj.emp ? 'empilhavel' : ''}`;
        elm.style.transform = obj.tilted ? `perspective(500px) rotateY(${obj.angulo / 2}deg)` : 'none';
        processarCargas();
    }

    // Vincula os eventos ao elemento
    elm.onmousedown = iniciarArrasto;
    elm.ontouchstart = iniciarArrasto;
}

function buscarMelhorPosicao(obj) {
    const cfg = containers[document.getElementById('tipoContainer').value];
    for (let r = 0.05; r <= 0.8; r += 0.05) {
        for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 8) {
            let tx = obj.x + Math.cos(ang) * r;
            let ty = obj.y + Math.sin(ang) * r;
            if (tx >= 0 && tx + obj.comp <= cfg.comprimento && ty >= 0 && ty + obj.larg <= cfg.largura) {
                if (!detectarColisao(obj.id, tx, ty, obj.comp, obj.larg, obj.z)) {
                    if (obj.z === 0 || calcularAutoTilt(tx, ty, obj.comp, obj.larg, obj.alt)?.possivel) return { x: tx, y: ty };
                }
            }
        }
    }
    return null;
}

/** PROCESSAMENTO DE CG E VISTA LATERAL **/
function processarCargas() {
    const total = paletes.reduce((s, p) => s + (p.peso || 0), 0);
    const cfg = containers[document.getElementById('tipoContainer').value];

    document.getElementById('pesoDisplay').innerText = `${total} / ${cfg.pesoMax} kg`;
    document.getElementById('progressFill').style.width = (total / cfg.pesoMax * 100) + '%';

    const resDiv = document.getElementById('resultados');
    if (total === 0) {
        document.getElementById('cg-indicator-point').style.display = 'none';
        resDiv.style.display = 'none';
        renderSide(); atualizarTabelaImpressao();
        return;
    }

    resDiv.style.display = 'block';
    let mX = 0, mY = 0;
    paletes.forEach(p => { mX += p.peso * (p.x + p.comp / 2); mY += p.peso * (p.y + p.larg / 2); });

    const cgX = mX / total, cgY = mY / total;
    const dx = cgX - (cfg.comprimento / 2);
    const kgDeslocados = (Math.abs(dx) * total) / (cfg.comprimento / 2);

    const pt = document.getElementById('cg-indicator-point');
    pt.style.display = 'block'; pt.style.left = (cgX * ESCALA) + "px"; pt.style.top = (cgY * ESCALA) + "px";

    document.getElementById('resPesoTotal').innerText = `Massa Bruta: ${total}kg`;
    document.getElementById('resDeslocamento').innerHTML = `Desvio Eixo X: ${Math.abs(dx).toFixed(2)}m (${dx > 0 ? 'Frente' : 'Fundo'})<br>Força de Alavanca: <b>${kgDeslocados.toFixed(0)}kg</b>`;
    document.getElementById('resSugestao').innerText = Math.abs(dx) > 0.3 ? `Alerta: Mova carga para o ${dx > 0 ? 'Fundo' : 'Frente'}.` : "Container Estável.";

    // Atualiza classes do Top View
    paletes.forEach(p => {
        const el = document.getElementById(p.id);
        if (p.z === 1) {
            const res = calcularAutoTilt(p.x, p.y, p.comp, p.larg, p.alt);
            if (res && res.tilt) {
                el.classList.add('tilted');
                el.style.transform = `perspective(500px) rotateY(${res.angulo / 2}deg)`;
            } else {
                el.classList.remove('tilted');
                el.style.transform = 'none';
            }
        }
    });

    renderSide();
    atualizarTabelaImpressao();
}

function renderSide() {
    const side = document.getElementById('side-view-container');
    const yAxis = side.querySelector('.y-axis');
    side.innerHTML = ''; if (yAxis) side.appendChild(yAxis);

    paletes.forEach(p => {
        const b = document.createElement('div');
        b.className = 'side-palete-block';
        b.style.width = (p.comp * ESCALA) + "px";
        b.style.height = (p.alt * ESCALA) + "px";
        b.style.left = (p.x * ESCALA) + "px";

        let hBase = 0;
        if (p.z === 1) {
            const res = calcularAutoTilt(p.x, p.y, p.comp, p.larg, p.alt);
            if (res && res.possivel) {
                hBase = res.hBase;
                if (res.tilt) {
                    // MÁGICA DA FÍSICA APLICADA NO DOM: 
                    // Setando o ponto exato da quina como dobradiça
                    let originX = (res.pivotX - p.x) * ESCALA;
                    b.style.transformOrigin = `${originX}px bottom`;
                    b.style.transform = `rotate(${res.angulo}deg)`;
                } else {
                    b.style.transformOrigin = `center bottom`;
                    b.style.transform = `none`;
                }
            }
        }
        b.style.bottom = (hBase * ESCALA) + "px";
        b.style.backgroundColor = p.z === 0 ? "var(--z0-color)" : "var(--z1-color)";
        side.appendChild(b);
    });
}

/** FUNÇÕES UTILITÁRIAS, MODAL E JSON (MANTIDAS EXATAMENTE IGUAIS) **/

function mostrarTooltip(e, p) {
    const tt = document.getElementById('tooltip-info');
    let html = `<strong>${p.nome}</strong><br>Peso Total: ${p.peso}kg | Dim: ${p.comp}x${p.larg}m<hr>`;
    if (p.itensInternos && p.itensInternos.length > 0) {
        p.itensInternos.forEach(i => {
            const dim = `${i.c || 0}x${i.l || 0}x${i.a || 0}m`;
            html += `• <b>[${i.id || 'S/ID'}]</b> ${i.desc} (Qtd: ${i.qtd || 1}) <br>  <span style="color:#94a3b8; font-size:10px; margin-left:10px;">Medidas: ${dim} | ${i.p || 0}kg</span><br>`;
        });
    } else { html += "<em style='color:#94a3b8;'>Sem itens detalhados</em>"; }
    tt.innerHTML = html; tt.style.display = 'block';
}

function moverTooltip(e) {
    const tt = document.getElementById('tooltip-info');
    tt.style.left = (e.clientX + 15) + "px"; tt.style.top = (e.clientY + 15) + "px";
}

function esconderTooltip() { document.getElementById('tooltip-info').style.display = 'none'; }

function abrirModalDetalhes(id) {
    paleteSendoEditado = paletes.find(p => p.id === id);
    document.getElementById('modalTitle').innerText = `Edição: ${paleteSendoEditado.nome}`;
    const container = document.getElementById('listaItensInternos');
    container.innerHTML = '';
    if (paleteSendoEditado.itensInternos && paleteSendoEditado.itensInternos.length > 0) {
        paleteSendoEditado.itensInternos.forEach(item => adicionarLinhaItem(item));
    } else { adicionarLinhaItem(); }
    document.getElementById('modalDetalhes').style.display = 'block';
}

function adicionarLinhaItem(dados = { id: '', desc: '', qtd: '', c: '', l: '', a: '', p: '' }) {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
        <input type="text" placeholder="ID" value="${dados.id || ''}" class="it-id">
        <input type="text" placeholder="Descrição" value="${dados.desc || ''}" class="it-desc">
        <input type="number" placeholder="Qtd" value="${dados.qtd || ''}" class="it-qtd">
        <input type="number" placeholder="C(m)" value="${dados.c || ''}" class="it-c" step="0.01">
        <input type="number" placeholder="L(m)" value="${dados.l || ''}" class="it-l" step="0.01">
        <input type="number" placeholder="A(m)" value="${dados.a || ''}" class="it-a" step="0.01">
        <input type="number" placeholder="Kg" value="${dados.p || ''}" class="it-p" step="0.1">
        <button onclick="this.parentElement.remove()" style="color:var(--red); background:none; font-size:24px; font-weight:bold; cursor:pointer;">×</button>
    `;
    document.getElementById('listaItensInternos').appendChild(div);
}

function salvarDetalhesPalete() {
    const rows = document.querySelectorAll('.item-row');
    const itens = [];
    rows.forEach(r => {
        const id = r.querySelector('.it-id').value;
        const desc = r.querySelector('.it-desc').value;
        const qtd = r.querySelector('.it-qtd').value;
        const c = r.querySelector('.it-c').value;
        const l = r.querySelector('.it-l').value;
        const a = r.querySelector('.it-a').value;
        const p = r.querySelector('.it-p').value;
        if (id || desc) itens.push({ id, desc, qtd, c, l, a, p });
    });
    paleteSendoEditado.itensInternos = itens;
    fecharModal();
    atualizarTabelaImpressao();
}
function fecharModal() { document.getElementById('modalDetalhes').style.display = 'none'; paleteSendoEditado = null; }

function exportarLayout() {
    if (paletes.length === 0) return alert("Não há carga para salvar.");
    const dados = { container: document.getElementById('tipoContainer').value, paletes: paletes };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Container_Logsim${Date.now()}.json`;
    link.click();
}

function importarLayout(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const dados = JSON.parse(e.target.result);
            document.getElementById('tipoContainer').value = dados.container || "20";
            limparContainer();
            dados.paletes.forEach(p => {
                const novo = { ...p, id: "p_" + Math.random().toString(36).substr(2, 9), itensInternos: p.itensInternos || [] };
                paletes.push(novo);
                renderizar(novo);
            });
            processarCargas();
            alert("Layout carregado com sucesso!");
        } catch (err) { alert("Erro ao carregar o arquivo JSON."); }
    };
    reader.readAsText(arquivo);
    event.target.value = '';
}

function atualizarTabelaImpressao() {
    document.getElementById('print-date').innerText = new Date().toLocaleString();
    const tbody = document.querySelector('#lista-paletes-print tbody');
    tbody.innerHTML = '';
    paletes.forEach(p => {
        let itensTexto = p.itensInternos && p.itensInternos.length > 0
            ? p.itensInternos.map(i => `${i.desc} (${i.qtd})`).join(', ') : "N/A";
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${p.nome}</strong></td><td>${itensTexto}</td><td>Z:${p.z}</td><td>${p.peso}</td><td>${p.comp}x${p.larg}x${p.alt}</td><td>(${p.x.toFixed(2)}, ${p.y.toFixed(2)})</td>`;
        tbody.appendChild(tr);
    });
}

function atualizarLabelsMedida() {
    const und = document.getElementById('unidadeMedida').value;
    document.getElementById('lblComp').innerText = `C (${und})`;
    document.getElementById('lblLarg').innerText = `L (${und})`;
    document.getElementById('lblAlt').innerText = `A (${und})`;
    
    // Ajusta o "step" da setinha do input dependendo da unidade
    const step = und === 'm' ? '0.05' : (und === 'cm' ? '1' : '10');
    document.getElementById('pComprimento').step = step;
    document.getElementById('pLargura').step = step;
    document.getElementById('pAltura').step = step;
    
    // Atualiza os valores atuais para a nova unidade selecionada
    setTamanhoPadrao(); 
}

function setTamanhoPadrao() {
    const und = document.getElementById('unidadeMedida').value;
    let fator = 1;
    if (und === 'cm') fator = 100;
    if (und === 'mm') fator = 1000;

    // Palete PBR Padrão: 1.2m x 1.0m x 1.1m (ajustado pelo fator da unidade)
    document.getElementById('pComprimento').value = (1.2 * fator).toFixed(und === 'm' ? 2 : 0);
    document.getElementById('pLargura').value = (1.0 * fator).toFixed(und === 'm' ? 2 : 0);
    document.getElementById('pAltura').value = (1.1 * fator).toFixed(und === 'm' ? 2 : 0);
    document.getElementById('pPeso').value = 500;
}

function remover(id) { paletes = paletes.filter(p => p.id !== id); document.getElementById(id).remove(); processarCargas(); }
function filtrarNivel(z) { nivelVisivel = z; paletes.forEach(p => { const el = document.getElementById(p.id); if (el) { el.style.opacity = (p.z === z) ? "1" : "0.15"; el.style.pointerEvents = (p.z === z) ? "all" : "none"; } }); }
function mostrarFeedback(x, y) { const fb = document.getElementById('feedback-msg'); fb.style.left = (x - 60) + "px"; fb.style.top = (y - 40) + "px"; fb.style.display = 'block'; setTimeout(() => fb.style.display = 'none', 1500); }
function limparTudoComConfirmacao() { if (confirm("Deseja apagar todo o planejamento?")) mudarContainer(); }
import { state } from '../store/state.js';
import { limparContainer, renderizar, processarCargas } from '../core/container.js';

export function exportarLayout() {
    if (state.paletes.length === 0) return alert("Não há carga para salvar.");
    const blob = new Blob([JSON.stringify({ container: document.getElementById('tipoContainer').value, paletes: state.paletes }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `layout_logisim_${Date.now()}.json`; link.click();
}

export function importarLayout(event) {
    const arquivo = event.target.files[0]; if (!arquivo) return; const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const dados = JSON.parse(e.target.result); document.getElementById('tipoContainer').value = dados.container || "20"; limparContainer();
            dados.paletes.forEach(p => { const novo = { ...p, id: "p_" + Math.random().toString(36).substr(2, 9), itensInternos: p.itensInternos || [] }; state.paletes.push(novo); renderizar(novo); });
            processarCargas(); alert("Layout carregado com sucesso!");
        } catch (err) { alert("Erro ao carregar o arquivo JSON."); }
    }; reader.readAsText(arquivo); event.target.value = '';
}

export function atualizarTabelaImpressao() {
    document.getElementById('print-date').innerText = new Date().toLocaleString(); const tbody = document.querySelector('#lista-paletes-print tbody'); tbody.innerHTML = '';
    state.paletes.forEach(p => {
        let itensTexto = p.itensInternos && p.itensInternos.length > 0 ? p.itensInternos.map(i => `${i.id} - ${i.desc} (Pos: ${i.x.toFixed(2)}, ${i.y.toFixed(2)}, Z:${i.z})`).join('<br>') : "Palete Fechado";
        const tr = document.createElement('tr'); tr.innerHTML = `<td><strong>${p.nome}</strong></td><td>${itensTexto}</td><td>Z:${p.z}</td><td>${p.peso}</td><td>${p.comp}x${p.larg}x${p.alt}</td><td>(${p.x.toFixed(2)}, ${p.y.toFixed(2)})</td>`; tbody.appendChild(tr);
    });
}
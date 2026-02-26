import { state } from './store/state.js';
import * as interfaceUI from './ui/interface.js';
import * as containerLogic from './core/container.js';
import * as palletLogic from './wms/palletEditor.js';
import * as ioLogic from './utils/io.js';

// 1. Inicialização e Listeners Globais
window.onload = () => {
    interfaceUI.ajustarEscalaResponsiva();
    containerLogic.mudarContainer();
    if (localStorage.getItem('logisim_tutorial_hidden') !== 'true') interfaceUI.abrirTutorial();
};

window.addEventListener('resize', () => { 
    interfaceUI.ajustarEscalaResponsiva(); 
});

// 2. Expondo funções para o HTML (Garante que seus onclick="" continuem funcionando)
Object.assign(window, {
    abrirTutorial: interfaceUI.abrirTutorial,
    fecharTutorial: interfaceUI.fecharTutorial,
    toggleSidebar: interfaceUI.toggleSidebar,
    mudarContainer: containerLogic.mudarContainer,
    atualizarLabelsMedida: interfaceUI.atualizarLabelsMedida,
    adicionarNovoPalete: containerLogic.adicionarNovoPalete,
    filtrarNivel: containerLogic.filtrarNivel,
    remover: containerLogic.remover,
    limparTudoComConfirmacao: containerLogic.limparTudoComConfirmacao,
    
    // Funções WMS
    atualizarLabelsMedidaPalete: palletLogic.atualizarLabelsMedidaPalete,
    adicionarCaixaNoPalete: palletLogic.adicionarCaixaNoPalete,
    filtrarNivelPalete: palletLogic.filtrarNivelPalete,
    removerCaixaPalete: palletLogic.removerCaixaPalete,
    salvarDetalhesPalete: palletLogic.salvarDetalhesPalete,
    fecharModal: palletLogic.fecharModal,
    abrirModalDetalhes: palletLogic.abrirModalDetalhes,

    // IO
    exportarLayout: ioLogic.exportarLayout,
    importarLayout: ioLogic.importarLayout
});
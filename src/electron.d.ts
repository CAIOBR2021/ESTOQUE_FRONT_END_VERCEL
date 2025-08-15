// Este arquivo informa ao TypeScript sobre a API que expomos no preload.js
// Em: src/electron.d.ts

// CORREÇÃO: Importe o tipo Movimentacao também
import { Produto, Movimentacao } from './App';

export interface IElectronAPI {
  getProdutos: () => Promise<Produto[]>;
  addProduto: (produto: Produto) => Promise<{ id: number }>;
  updateProduto: (id: string, patch: Partial<Produto>) => Promise<{ changes: number }>;
  deleteProduto: (id: string) => Promise<{ changes: number }>;

  // --- ADICIONE ESTAS DUAS LINHAS ---
  getMovs: () => Promise<Movimentacao[]>;
  addMov: (mov: Movimentacao) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
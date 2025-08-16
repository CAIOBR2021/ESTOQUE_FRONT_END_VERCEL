import React, { useEffect, useState, useMemo } from 'react';
import meuLogo from './assets/logo.png';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- DEFINIÇÕES DE TIPO ---
export type UUID = string;

export interface Produto {
  id: UUID;
  sku: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  unidade: string;
  quantidade: number;
  estoqueMinimo?: number;
  localArmazenamento?: string;
  fornecedor?: string;
  criadoEm: string;
  atualizadoEm?: string;
}

export type TipoMov = 'entrada' | 'saida' | 'ajuste';

export interface Movimentacao {
  id: UUID;
  produtoId: UUID;
  tipo: TipoMov;
  quantidade: number;
  motivo?: string;
  criadoEm: string;
}

// URL da nossa API Backend (AGORA USANDO O PROXY)
const API_URL = '/api';

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [produtosRes, movsRes] = await Promise.all([
          fetch(`${API_URL}/produtos`),
          fetch(`${API_URL}/movimentacoes`),
        ]);

        if (!produtosRes.ok || !movsRes.ok) {
          throw new Error('Resposta de rede não foi bem-sucedida.');
        }

        const produtosData = await produtosRes.json();
        const movsData = await movsRes.json();
        setProdutos(produtosData);
        setMovs(movsData);
      } catch (err: any) {
        console.error('Falha ao buscar dados:', err);
        setError('Não foi possível conectar ao servidor.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // --- FUNÇÕES DE CRUD ---
  async function addProduto(
    p: Omit<Produto, 'id' | 'criadoEm' | 'atualizadoEm' | 'sku'>,
  ) {
    try {
      const response = await fetch(`${API_URL}/produtos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      if (!response.ok) throw new Error('Falha ao criar produto');
      const novoProduto = await response.json();
      setProdutos((prev) => [novoProduto, ...prev]);
    } catch (err) {
      console.error(err);
    }
  }

  async function updateProduto(
    id: UUID,
    patch: Partial<Omit<Produto, 'id' | 'sku' | 'criadoEm'>>,
  ) {
    try {
      const response = await fetch(`${API_URL}/produtos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error('Falha ao atualizar produto');

      // A API agora retorna o produto atualizado, vamos usá-lo para ter a data "atualizadoEm" correta do servidor
      const produtoAtualizado = await response.json();

      setProdutos((prev) =>
        prev.map((x) =>
          x.id === id
            ? produtoAtualizado // Usa o objeto retornado pela API
            : x,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteProduto(id: UUID) {
    try {
      const response = await fetch(`${API_URL}/produtos/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Falha ao excluir produto');
      setProdutos((prev) => prev.filter((p) => p.id !== id));
      setMovs((prev) => prev.filter((m) => m.produtoId !== id));
    } catch (err) {
      console.error(err);
    }
  }

  async function addMov(m: Omit<Movimentacao, 'id' | 'criadoEm'>) {
    try {
      const response = await fetch(`${API_URL}/movimentacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      });
      if (!response.ok) throw new Error('Falha ao criar movimentação');
      
      const { movimentacao, produto } = await response.json();

      setMovs((prev) => [movimentacao, ...prev]);
      setProdutos((prev) => prev.map(p => p.id === produto.id ? produto : p));

    } catch (err) {
      console.error(err);
    }
  }

  // --- LÓGICA DE FILTRAGEM ---
  const [q, setQ] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [mostrarAbaixoMin, setMostrarAbaixoMin] = useState(false);

  const categorias = useMemo(
    () =>
      Array.from(
        new Set(produtos.map((p) => p.categoria || '').filter(Boolean)),
      ),
    [produtos],
  );

  const filteredProdutos = useMemo(
    () =>
      produtos.filter((p) => {
        const term = q.trim().toLowerCase();
        if (
          mostrarAbaixoMin &&
          (p.estoqueMinimo === undefined || p.quantidade > p.estoqueMinimo)
        )
          return false;
        if (categoriaFilter && p.categoria !== categoriaFilter) return false;
        if (!term) return true;
        return (
          p.nome.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.categoria || '').toLowerCase().includes(term)
        );
      }),
    [produtos, q, categoriaFilter, mostrarAbaixoMin],
  );

  if (loading) {
    return (
      <div className="container py-4">
        <h4>Carregando dados...</h4>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <header className="d-flex justify-content-between align-items-center mb-5 P-3 border-bottom">
        <img src={meuLogo} alt="Logo da Empresa" style={{ height: '60px' }} />
        <h2 className="fs-5 mb-0 text-muted">Sistema de Controle de Estoque</h2>
      </header>

      <div className="row mb-3">
        <div className="col-md-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="input-group">
              <input
                className="form-control"
                placeholder="Pesquisar por nome, SKU ou categoria"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setQ('')}
              >
                Limpar
              </button>
            </div>
          </form>
        </div>
        <div className="col-md-4 d-flex justify-content-end">
          <BotaoNovoProduto onCreate={addProduto} categorias={categorias} />
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-md-3">
          <select
            className="form-select"
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-3 d-flex align-items-center">
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={mostrarAbaixoMin}
              id="abaixoMin"
              onChange={(e) => setMostrarAbaixoMin(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="abaixoMin">
              Abaixo do mínimo
            </label>
          </div>
        </div>
        <div className="col-md-6 text-end">
          <Relatorios
            produtos={produtos}
            categoriaSelecionada={categoriaFilter}
          />
        </div>
      </div>

      <ProdutosTable
        produtos={filteredProdutos}
        onEdit={updateProduto}
        onDelete={deleteProduto}
        onAddMov={addMov}
        categorias={categorias}
      />
      
      <hr className="my-4" />
      <h5 className="mb-3">Movimentações Recentes</h5>
      <MovsList movs={movs.slice(0, 10)} produtos={produtos} />
    </div>
  );
}

// --- TODOS OS COMPONENTES FILHOS PRECISAM ESTAR AQUI ---

function BotaoNovoProduto({
  onCreate,
  categorias,
}: {
  onCreate: (
    p: Omit<Produto, 'id' | 'criadoEm' | 'atualizadoEm' | 'sku'>,
  ) => void;
  categorias: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Novo Produto
      </button>
      {open && (
        <Modal title="Novo Produto" onClose={() => setOpen(false)}>
          <ProdutoForm
            onCancel={() => setOpen(false)}
            onSave={(p) => {
              onCreate(p);
              setOpen(false);
            }}
            categorias={categorias}
          />
        </Modal>
      )}
    </>
  );
}

function ProdutoForm({
  onCancel,
  onSave,
  produto,
  categorias,
}: {
  onCancel: () => void;
  onSave: (p: any) => void;
  produto?: Produto;
  categorias: string[];
}) {
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [categoria, setCategoria] = useState(produto?.categoria ?? '');
  const [unidade, setUnidade] = useState(produto?.unidade ?? 'un');
  const [quantidade, setQuantidade] = useState<number>(
    produto?.quantidade ?? 0,
  );
  const [estoqueMinimo, setEstoqueMinimo] = useState<number | undefined>(
    produto?.estoqueMinimo ?? undefined,
  );
  const [localArmazenamento, setLocalArmazenamento] = useState(
    produto?.localArmazenamento ?? '',
  );
  const [fornecedor, setFornecedor] = useState(produto?.fornecedor ?? '');
  // ##################################################################
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;

    // Este é o objeto base com os campos que podem ser editados
    const baseData = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      categoria: categoria.trim() || undefined,
      unidade,
      estoqueMinimo,
      localArmazenamento: localArmazenamento.trim() || undefined,
      fornecedor: fornecedor.trim() || undefined,
    };

    // Se o 'produto' não existe, estamos criando um novo, então adicionamos a quantidade inicial.
    // Se o 'produto' existe, estamos editando, então usamos apenas o baseData (sem a quantidade).
    const finalData = !produto
      ? { ...baseData, quantidade }
      : baseData;

    onSave(finalData);
  }
  // ##################################################################
  // ### FIM DA CORREÇÃO ###
  // ##################################################################


  return (
    <form onSubmit={submit}>
        <div className="row g-3">
        {produto && (
            <div className="col-md-4">
            <label className="form-label">SKU</label>
            <input
                className="form-control"
                value={produto.sku}
                readOnly
                disabled
            />
            </div>
        )}
        <div className={produto ? 'col-md-8' : 'col-md-12'}>
            <label className="form-label">Nome *</label>
            <input
            className="form-control"
            placeholder="Ex: Parafuso Sextavado"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            />
        </div>
        <div className="col-12">
            <label className="form-label">Descrição</label>
            <textarea
            className="form-control"
            placeholder="Detalhes do produto (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            />
        </div>
        <div className="col-md-6">
            <label className="form-label">Categoria</label>
            <input
            className="form-control"
            placeholder="Ex: Ferragens"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            list="cats"
            />
            <datalist id="cats">
            {categorias.map((c) => (
                <option key={c} value={c} />
            ))}
            </datalist>
        </div>
        <div className="col-md-6">
            <label className="form-label">Local de Armazenamento</label>
            <input
            className="form-control"
            placeholder="Ex: Pátio 04"
            value={localArmazenamento}
            onChange={(e) => setLocalArmazenamento(e.target.value)}
            />
        </div>
        <div className="col-md-4">
            <label className="form-label">Unidade de Medida</label>
            <input
            className="form-control"
            placeholder="un, kg, m, L"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            required
            />
        </div>
        <div className="col-md-4">
            <label className="form-label">Quantidade Inicial</label>
            <input
            type="number"
            min={0}
            className="form-control"
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            disabled={!!produto}
            />
        </div>
        <div className="col-md-4">
            <label className="form-label">Estoque Mínimo</label>
            <input
            type="number"
            min={0}
            className="form-control"
            value={estoqueMinimo ?? ''}
            onChange={(e) =>
                setEstoqueMinimo(
                e.target.value === '' ? undefined : Number(e.target.value),
                )
            }
            />
        </div>
        <div className="col-md-12">
            <label className="form-label">Fornecedor</label>
            <input
            className="form-control"
            placeholder="Nome do fornecedor (opcional)"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            />
        </div>
        </div>
        <div className="text-end mt-4">
        <button
            type="button"
            className="btn btn-secondary me-2"
            onClick={onCancel}
        >
            Cancelar
        </button>
        <button type="submit" className="btn btn-primary">
            Salvar
        </button>
        </div>
    </form>
  );
}

function ProdutosTable({
  produtos,
  onEdit,
  onDelete,
  onAddMov,
  categorias,
}: {
  produtos: Produto[];
  onEdit: (id: UUID, patch: Partial<Produto>) => void;
  onDelete: (id: UUID) => void;
  onAddMov: (m: Omit<Movimentacao, 'id' | 'criadoEm'>) => void;
  categorias: string[];
}) {
  const [editingId, setEditingId] = useState<UUID | null>(null);
  const [movProdId, setMovProdId] = useState<UUID | null>(null);
  const [deleteId, setDeleteId] = useState<UUID | null>(null);

  const produtoParaEditar = useMemo(
    () => produtos.find((p) => p.id === editingId),
    [editingId, produtos],
  );
  const produtoParaMov = useMemo(
    () => produtos.find((p) => p.id === movProdId),
    [movProdId, produtos],
  );
  const produtoParaDeletar = useMemo(
    () => produtos.find((p) => p.id === deleteId),
    [deleteId, produtos],
  );

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>SKU</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Qtd.</th>
              <th>Estoque Mín.</th>
              <th>Local</th>
              <th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr
                key={p.id}
                className={
                  p.estoqueMinimo !== undefined &&
                  p.quantidade <= p.estoqueMinimo
                    ? 'table-warning'
                    : ''
                }
              >
                <td>
                  <small className="text-muted">{p.sku}</small>
                </td>
                <td>{p.nome}</td>
                <td>{p.categoria ?? '-'}</td>
                <td>
                  {p.quantidade}{' '}
                  <small className="text-muted">{p.unidade}</small>
                </td>
                <td>{p.estoqueMinimo ?? '-'}</td>
                <td>{p.localArmazenamento ?? '-'}</td>
                <td>
                  <div className="btn-group float-end" role="group">
                    <button
                      className="btn btn-sm btn-outline-success"
                      onClick={() => setMovProdId(p.id)}
                    >
                      Movimentar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => setEditingId(p.id)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setDeleteId(p.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {produtos.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-4">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {produtoParaEditar && (
        <Modal
          title={`Editar: ${produtoParaEditar.nome}`}
          onClose={() => setEditingId(null)}
        >
          <ProdutoForm
            produto={produtoParaEditar}
            onCancel={() => setEditingId(null)}
            onSave={(vals) => {
              onEdit(editingId!, vals);
              setEditingId(null);
            }}
            categorias={categorias}
          />
        </Modal>
      )}

      {produtoParaMov && (
        <Modal
          title={`Movimentar: ${produtoParaMov.nome}`}
          onClose={() => setMovProdId(null)}
        >
          <MovimentacaoForm
            produto={produtoParaMov}
            onCancel={() => setMovProdId(null)}
            onSave={(m) => {
              onAddMov(m);
              setMovProdId(null);
            }}
          />
        </Modal>
      )}

      {produtoParaDeletar && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteId(null)}>
          <p>
            Você tem certeza que deseja excluir o produto{' '}
            <strong>{produtoParaDeletar.nome}</strong>?
          </p>
          <p>
            Esta ação não pode ser desfeita e removerá todas as movimentações
            associadas.
          </p>
          <div className="text-end mt-4">
            <button
              className="btn btn-secondary me-2"
              onClick={() => setDeleteId(null)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                onDelete(deleteId!);
                setDeleteId(null);
              }}
            >
              Confirmar Exclusão
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function MovimentacaoForm({
  produto,
  onCancel,
  onSave,
}: {
  produto: Produto;
  onCancel: () => void;
  onSave: (m: Omit<Movimentacao, 'id' | 'criadoEm'>) => void;
}) {
  const [tipo, setTipo] = useState<TipoMov>('saida');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [motivo, setMotivo] = useState<string>('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (quantidade <= 0) return;
    onSave({
      produtoId: produto.id,
      tipo,
      quantidade,
      motivo: motivo.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit}>
        <div className="mb-3">
        Estoque atual:{' '}
        <strong>
            {produto.quantidade} {produto.unidade}
        </strong>
        </div>
        <div className="row g-3">
        <div className="col-md-4">
            <label className="form-label">Tipo</label>
            <select
            className="form-select"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMov)}
            >
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
            <option value="ajuste">Ajuste de Estoque</option>
            </select>
        </div>
        <div className="col-md-4">
            <label className="form-label">
            {tipo === 'ajuste' ? 'Nova Quantidade' : 'Quantidade'}
            </label>
            <input
            type="number"
            min={1}
            className="form-control"
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            required
            />
        </div>
        <div className="col-md-4">
            <label className="form-label">Motivo (opcional)</label>
            <input
            className="form-control"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Uso na obra, Requisição"
            />
        </div>
        </div>
        <div className="text-end mt-4">
        <button
            type="button"
            className="btn btn-secondary me-2"
            onClick={onCancel}
        >
            Cancelar
        </button>
        <button type="submit" className="btn btn-primary">
            Salvar Movimentação
        </button>
        </div>
    </form>
  );
}

function MovsList({
  movs,
  produtos,
}: {
  movs: Movimentacao[];
  produtos: Produto[];
}) {
  const getProdutoNome = (id: UUID) =>
    produtos.find((p) => p.id === id)?.nome ?? 'Produto não encontrado';

  if (movs.length === 0) {
    return (
      <div className="text-center text-muted py-3">
        Nenhuma movimentação registrada ainda.
      </div>
    );
  }

  return (
    <ul className="list-group">
      {movs.map((m) => (
        <li
          key={m.id}
          className="list-group-item d-flex justify-content-between align-items-center"
        >
          <div>
            <span
              className={`badge me-2 bg-${
                m.tipo === 'entrada'
                  ? 'success'
                  : m.tipo === 'saida'
                  ? 'danger'
                  : 'warning'
              }`}
            >
              {m.tipo.toUpperCase()}
            </span>
            <strong>{m.quantidade}</strong> para o produto{' '}
            <strong>{getProdutoNome(m.produtoId)}</strong>
            {m.motivo && (
              <small className="d-block text-muted">Motivo: {m.motivo}</small>
            )}
          </div>
          <small className="text-muted">
            {new Date(m.criadoEm).toLocaleString('pt-BR')}
          </small>
        </li>
      ))}
    </ul>
  );
}

function Relatorios({
  produtos,
  categoriaSelecionada,
}: {
  produtos: Produto[];
  categoriaSelecionada: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    try {
      const produtosParaRelatorio = categoriaSelecionada
        ? produtos.filter((p) => p.categoria === categoriaSelecionada)
        : produtos;

      const itemsToReorder = produtosParaRelatorio
        .filter(
          (p) =>
            p.estoqueMinimo !== undefined && p.quantidade < p.estoqueMinimo,
        )
        .map((p) => ({
          ...p,
          qtdRepor: p.estoqueMinimo! - p.quantidade,
        }));

      if (itemsToReorder.length === 0) {
        alert(
          `Nenhum item precisa de reposição${
            categoriaSelecionada ? ` na categoria "${categoriaSelecionada}"` : ''
          }.`,
        );
        setLoading(false);
        return;
      }

      const doc = new jsPDF();
      const title = `Relatório de Reposição${
        categoriaSelecionada ? `: ${categoriaSelecionada}` : ''
      }`;
      
      doc.text(title, 14, 22);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

      autoTable(doc, {
        startY: 35,
        head: [['SKU', 'Nome', 'Estoque Atual', 'Estoque Mínimo', 'Qtd. a Repor']],
        body: itemsToReorder.map((item) => [
          item.sku,
          item.nome,
          `${item.quantidade} ${item.unidade}`,
          `${item.estoqueMinimo} ${item.unidade}`,
          `${item.qtdRepor} ${item.unidade}`,
        ]),
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        alternateRowStyles: { fillColor: 245 },
      });

      doc.save(`relatorio-reposicao-${categoriaSelecionada || 'geral'}-${Date.now()}.pdf`);
      alert('Relatório gerado com sucesso! O download será iniciado.');
      
      setTimeout(() => {
        setLoading(false);
      }, 1500);

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Ocorreu um erro ao gerar o relatório. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <button
      className="btn btn-outline-secondary"
      onClick={handleGenerate}
      disabled={loading}
    >
      {loading ? 'Gerando...' : 'Gerar Relatório'}
    </button>
  );
}

function Modal({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="modal"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
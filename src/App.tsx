import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
const ITEMS_PER_PAGE = 25; // Define quantos itens carregar por vez

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'estoque' | 'movimentacoes'>('estoque');

  // --- Estados para Lazy Loading ---
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Estado para controlar a visibilidade do botão de rolagem
  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [produtosRes, movsRes] = await Promise.all([
          fetch(`${API_URL}/produtos?_page=1&_limit=${ITEMS_PER_PAGE}`),
          fetch(`${API_URL}/movimentacoes`),
        ]);

        if (!produtosRes.ok || !movsRes.ok) {
          throw new Error('Resposta de rede não foi bem-sucedida.');
        }

        const produtosData = await produtosRes.json();
        const movsData = await movsRes.json();
        setProdutos(produtosData);
        setMovs(movsData);

        if (produtosData.length < ITEMS_PER_PAGE) {
            setHasMore(false);
        }

      } catch (err: any) {
        console.error('Falha ao buscar dados:', err);
        setError('Não foi possível conectar ao servidor.');
      } finally {
        setInitialLoading(false);
      }
    }
    fetchInitialData();

    // Adiciona o event listener de rolagem
    window.addEventListener('scroll', checkScrollTop);
    return () => {
      // Remove o event listener na desmontagem do componente
      window.removeEventListener('scroll', checkScrollTop);
    };
  }, []);
  
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const response = await fetch(`${API_URL}/produtos?_page=${nextPage}&_limit=${ITEMS_PER_PAGE}`);
      if (!response.ok) throw new Error('Falha ao buscar mais produtos');
      
      const newProdutos = await response.json();
      
      setProdutos(prevProdutos => [...prevProdutos, ...newProdutos]);
      setPage(nextPage);

      if (newProdutos.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore]);

  const checkScrollTop = () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const totalScrollable = scrollHeight - clientHeight;
    const shouldShow = window.pageYOffset > totalScrollable / 2;
    
    setShowScroll(currentShow => {
        if (currentShow !== shouldShow) {
            return shouldShow;
        }
        return currentShow;
    });
  };

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      const produtoAtualizado = await response.json();
      setProdutos((prev) =>
        prev.map((x) => (x.id === id ? produtoAtualizado : x)),
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
      setProdutos((prev) => prev.map((p) => (p.id === produto.id ? produto : p)));
    } catch (err) {
      console.error(err);
    }
  }
  
  async function deleteMov(id: UUID) {
    try {
      const response = await fetch(`${API_URL}/movimentacoes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Falha ao excluir movimentação');
      const { produtoAtualizado } = await response.json();
      
      setMovs((prev) => prev.filter((m) => m.id !== id));
      setProdutos((prev) => 
        prev.map((p) => (p.id === produtoAtualizado.id ? produtoAtualizado : p))
      );

    } catch (err) {
      console.error(err);
    }
  }

  // --- LÓGICA DE FILTRAGEM (da tela de estoque) ---
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

  const locaisArmazenamento = useMemo(
    () =>
      Array.from(
        new Set(produtos.map((p) => p.localArmazenamento || '').filter(Boolean)),
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

  if (initialLoading) {
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
      <header className="d-flex justify-content-between align-items-center mb-4 P-3 border-bottom">
        <img src={meuLogo} alt="Logo da Empresa" style={{ height: '60px' }} />
        <nav className="ms-auto me-3">
          <button
            className={`btn btn-sm ${
              view === 'estoque' ? 'btn-primary' : 'btn-outline-primary'
            } me-2`}
            onClick={() => setView('estoque')}
          >
            Estoque
          </button>
          <button
            className={`btn btn-sm ${
              view === 'movimentacoes' ? 'btn-primary' : 'btn-outline-primary'
            }`}
            onClick={() => setView('movimentacoes')}
          >
            Movimentações
          </button>
        </nav>
        <h2 className="fs-5 mb-0 text-muted">Sistema de Controle de Estoque</h2>
      </header>
      {view === 'estoque' && (
        <>
          <div className="row mb-3">
            <div className="col-md-8">
              <form onSubmit={(e) => e.preventDefault()}>
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
              <BotaoNovoProduto onCreate={addProduto} categorias={categorias} locais={locaisArmazenamento} />
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
            locais={locaisArmazenamento}
          />
          
          <div className="text-center my-4">
            {loadingMore && <p>Carregando mais produtos...</p>}
            {hasMore && !loadingMore && (
              <button 
                className="btn btn-outline-primary" 
                onClick={handleLoadMore}
              >
                Carregar Mais
              </button>
            )}
            {!hasMore && produtos.length > 0 && (
                <p className="text-muted">Todos os produtos foram carregados.</p>
            )}
          </div>

          <hr className="my-4" />
          <h5 className="mb-3">Movimentações Recentes</h5>
          <MovsList movs={movs.slice(0, 10)} produtos={produtos} />
        </>
      )}

      {view === 'movimentacoes' && (
        <ConsultaMovimentacoes movs={movs} produtos={produtos} onDelete={deleteMov} />
      )}

      <button
        className="btn rounded-circle shadow-lg"
        onClick={scrollTop}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '50px',
          height: '50px',
          fontSize: '1.5rem',
          zIndex: 1000,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showScroll ? 1 : 0,
          transform: showScroll ? 'translateY(0)' : 'translateY(20px)',
          visibility: showScroll ? 'visible' : 'hidden',
          pointerEvents: showScroll ? 'auto' : 'none',
          transition: 'opacity 0.3s ease, transform 0.3s ease, visibility 0.3s',
          background: 'linear-gradient(45deg, #0d6efd, #0dcaf0)',
          color: 'white',
        }}
        title="Voltar para o topo"
      >
        <i className="bi bi-arrow-up"></i>
      </button>
    </div>
  );
}

// --- COMPONENTES FILHOS ---
// O restante do código (todos os componentes filhos) permanece exatamente o mesmo.
// ... (Cole aqui o restante dos seus componentes: ConsultaMovimentacoes, BotaoNovoProduto, etc.)
// ...

function ConsultaMovimentacoes({
  movs,
  produtos,
  onDelete,
}: {
  movs: Movimentacao[];
  produtos: Produto[];
  onDelete: (id: UUID) => void;
}) {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [categoria, setCategoria] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [deleteId, setDeleteId] = useState<UUID | null>(null);

  const produtoMap = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  );

  const categorias = useMemo(
    () =>
      Array.from(new Set(produtos.map((p) => p.categoria || '').filter(Boolean))),
    [produtos],
  );

  const filteredMovs = useMemo(() => {
    return movs.filter((mov) => {
      const movDate = new Date(mov.criadoEm);
      if (dataInicio && movDate < new Date(dataInicio)) return false;
      if (dataFim) {
        const fimDate = new Date(dataFim);
        fimDate.setHours(23, 59, 59, 999);
        if (movDate > fimDate) return false;
      }
      if (categoria) {
        const produto = produtoMap.get(mov.produtoId);
        if (!produto || produto.categoria !== categoria) return false;
      }
      return true;
    });
  }, [movs, produtoMap, dataInicio, dataFim, categoria]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredMovs.length, itemsPerPage]);
  
  const paginatedMovs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredMovs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMovs, currentPage, itemsPerPage]);

  const movParaDeletar = useMemo(
    () => movs.find((m) => m.id === deleteId),
    [deleteId, movs]
  );
  
  const resetFilters = () => {
    setDataInicio('');
    setDataFim('');
    setCategoria('');
  };

  return (
    <div>
      <h3 className="mb-4">Consulta de Movimentações</h3>
      <div className="row g-3 mb-4 p-3 border rounded bg-light align-items-end">
        <div className="col-md-3">
          <label htmlFor="dataInicio" className="form-label">Data de Início</label>
          <input type="date" id="dataInicio" className="form-control" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label htmlFor="dataFim" className="form-label">Data de Fim</label>
          <input type="date" id="dataFim" className="form-control" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label htmlFor="catFilter" className="form-label">Categoria</label>
          <select id="catFilter" className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-md-2">
            <label htmlFor="itemsPerPage" className="form-label">Itens por pág.</label>
            <select id="itemsPerPage" className="form-select" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                <option value={30}>30</option>
                <option value={70}>70</option>
                <option value={100}>100</option>
            </select>
        </div>
        <div className="col-md-1">
          <button className="btn btn-outline-secondary w-100" onClick={resetFilters}>Limpar</button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Data/Hora</th>
              <th>Produto</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Motivo</th>
              <th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMovs.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.criadoEm).toLocaleString('pt-BR')}</td>
                <td>{produtoMap.get(m.produtoId)?.nome ?? 'N/A'}</td>
                <td>
                  <span className={`badge bg-${m.tipo === 'entrada' ? 'success' : m.tipo === 'saida' ? 'danger' : 'warning'}`}>
                    {m.tipo.toUpperCase()}
                  </span>
                </td>
                <td>
                  {m.quantidade}{' '}
                  <small className="text-muted">{produtoMap.get(m.produtoId)?.unidade}</small>
                </td>
                <td>{m.motivo ?? '-'}</td>
                <td className="text-end">
                    <button 
                        className="btn btn-sm btn-outline-danger" 
                        onClick={() => setDeleteId(m.id)}
                        disabled={m.tipo === 'ajuste'}
                        title={m.tipo === 'ajuste' ? 'Não é possível excluir movimentações de ajuste' : 'Excluir movimentação'}
                    >
                        Excluir
                    </button>
                </td>
              </tr>
            ))}
            {filteredMovs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-4">
                  Nenhuma movimentação encontrada com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-3">
        <Paginacao
          totalItems={filteredMovs.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {movParaDeletar && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteId(null)}>
          <p>
            Você tem certeza que deseja excluir esta movimentação?
          </p>
          <ul className="list-group mb-3">
            <li className="list-group-item"><strong>Produto:</strong> {produtoMap.get(movParaDeletar.produtoId)?.nome}</li>
            <li className="list-group-item"><strong>Tipo:</strong> {movParaDeletar.tipo.toUpperCase()}</li>
            <li className="list-group-item"><strong>Quantidade:</strong> {movParaDeletar.quantidade}</li>
            <li className="list-group-item"><strong>Data:</strong> {new Date(movParaDeletar.criadoEm).toLocaleString('pt-BR')}</li>
          </ul>
          <p className="text-danger">
            Esta ação não pode ser desfeita e irá reverter a alteração no estoque do produto.
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
    </div>
  );
}

function BotaoNovoProduto({
  onCreate,
  categorias,
  locais,
}: {
  onCreate: (
    p: Omit<Produto, 'id' | 'criadoEm' | 'atualizadoEm' | 'sku'>,
  ) => void;
  categorias: string[];
  locais: string[];
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
            locais={locais}
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
  locais,
}: {
  onCancel: () => void;
  onSave: (p: any) => void;
  produto?: Produto;
  categorias: string[];
  locais: string[];
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;

    const baseData = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      categoria: categoria.trim() || undefined,
      unidade,
      estoqueMinimo,
      localArmazenamento: localArmazenamento.trim() || undefined,
      fornecedor: fornecedor.trim() || undefined,
    };

    const finalData = !produto ? { ...baseData, quantidade } : baseData;
    onSave(finalData);
  }

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
            list="locais"
          />
          <datalist id="locais">
            {locais.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
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
  locais,
}: {
  produtos: Produto[];
  onEdit: (id: UUID, patch: Partial<Produto>) => void;
  onDelete: (id: UUID) => void;
  onAddMov: (m: Omit<Movimentacao, 'id' | 'criadoEm'>) => void;
  categorias: string[];
  locais: string[];
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
            locais={locais}
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

function Paginacao({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
}: {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) {
    return null;
  }

  const handlePageClick = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  const renderPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    const pagesToShow = 3;

    if (totalPages <= pagesToShow + 4) { 
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);

      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
          startPage = 2;
          endPage = 3;
      }

      if (currentPage >= totalPages - 2) {
          startPage = totalPages - 2;
          endPage = totalPages - 1;
      }

      if (startPage > 2) {
          pageNumbers.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
          pageNumbers.push(i);
      }

      if (endPage < totalPages - 1) {
          pageNumbers.push('...');
      }

      pageNumbers.push(totalPages);
    }

    return pageNumbers.map((page, index) => (
      <li key={index} className={`page-item ${page === '...' ? 'disabled' : ''} ${currentPage === page ? 'active' : ''}`}>
        <button className="page-link" onClick={() => typeof page === 'number' && handlePageClick(page)}>
          {page}
        </button>
      </li>
    ));
  };
  
  return (
    <nav className="d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <span className="text-muted small">
          Exibindo {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} movimentações
        </span>
      </div>
      <ul className="pagination m-0">
        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => handlePageClick(currentPage - 1)} aria-label="Anterior">
            &lt;
          </button>
        </li>
        {renderPageNumbers()}
        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => handlePageClick(currentPage + 1)} aria-label="Próxima">
            &gt;
          </button>
        </li>
      </ul>
    </nav>
  );
}
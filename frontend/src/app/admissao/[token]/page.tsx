'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { CheckCircle2, AlertCircle, Loader2, Upload, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { admissionAPI, api } from '@/lib/api';
import toast from 'react-hot-toast';

type Step = 'form'|'docs'|'done';
const RACAS     = ['Branca','Preta','Parda','Amarela','Indígena','Não informado'];
const EST_CIVIL = ['Solteiro(a)','Casado(a)','Divorciado(a)','Viúvo(a)','União Estável'];
const ESCOLAR   = ['Fundamental Incompleto','Fundamental Completo','Médio Incompleto','Médio Completo','Superior Incompleto','Superior Completo','Pós-Graduação'];

const I = (p: any) => <input {...p} className={`w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${p.className||''}`} />;
const Sel = (p: any) => <select {...p} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />;
const FL = ({ label, children, req, span2 }: any) => (
  <div className={span2?'sm:col-span-2':''}>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}{req&&<span className="text-red-500 ml-0.5">*</span>}</label>
    {children}
  </div>
);
const CB = ({ label, ...props }: any) => (
  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
    <input type="checkbox" {...props} className="w-4 h-4 rounded accent-blue-600" />{label}
  </label>
);
const ST = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 -mx-6 px-6 py-3 mb-4 mt-1 border-b border-t border-slate-100 bg-slate-50">
    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{children}</h2>
  </div>
);

export default function AdmissaoFormPage() {
  const params = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('form');
  const [openDeps, setOpenDeps] = useState<number[]>([0]);

  const { data: proc, isLoading, isError } = useQuery({
    queryKey: ['admission-form', params.token],
    queryFn:  () => admissionAPI.getForm(params.token).then(r => r.data),
    retry: false,
  });

  const { register, handleSubmit, watch, control, formState:{ isSubmitting } } = useForm({
    defaultValues: { has_disability:false, doc_rg:false, doc_cpf:false, doc_pis:false, doc_titulo:false, doc_residencia:false, doc_reservista:false, doc_escolar:false, doc_faculdade:false, doc_certidao_nasc:false, doc_certidao_cas:false, dep_rg:false, dep_cpf:false, dep_certidao:false, dep_declaracao:false, dep_vacinacao:false, tipo_urbano:false, tipo_rural:false, aposentado:false, primeiro_emprego:false, vale_transporte:false, sexo:'', dependentes:[] as any[] },
  });
  const { fields: depFields, append: appendDep, remove: removeDep } = useFieldArray({ control, name:'dependentes' });

  const submitMutation = useMutation({
    mutationFn: (data: any) => admissionAPI.submitForm(params.token, data),
    onSuccess:  () => setStep('docs'),
    onError:    () => toast.error('Erro ao enviar formulário. Tente novamente.'),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (isError||!proc) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-800">Link inválido</h1>
        <p className="text-slate-500 mt-2 text-sm">Este link não existe, expirou ou já foi utilizado.<br />Entre em contato com o RH.</p>
      </div>
    </div>
  );
  if (step==='done') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center max-w-sm">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Tudo pronto! 🎉</h1>
        <p className="text-slate-500 mt-3 text-sm leading-relaxed">Seus dados foram recebidos com sucesso.<br />O RH entrará em contato pelo email <strong>{proc.candidate_email}</strong>.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-3"><span className="text-white font-bold text-sm">CASCA</span></div>
          <h1 className="text-2xl font-bold text-slate-800">Ficha Cadastral</h1>
          <p className="text-slate-500 mt-1 text-sm">Olá, <strong>{proc.candidate_name}</strong>! Preencha seus dados com atenção.</p>
          {proc.position_name && (
            <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full">
              Vaga: <strong>{proc.position_name}</strong>{proc.unit_name&&` · ${proc.unit_name}`}
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {['Dados e documentos','Enviar arquivos'].map((s,i)=>(
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${(i===0&&step==='form')?'bg-blue-600 text-white':(i===1&&step==='docs')?'bg-blue-600 text-white':(i===0&&step==='docs')?'bg-emerald-500 text-white':'bg-slate-200 text-slate-500'}`}>
                {i===0&&step!=='form'?'✓':i+1}
              </div>
              <span className={`text-sm ${(i===0&&step==='form')||(i===1&&step==='docs')?'font-medium text-slate-800':'text-slate-400'}`}>{s}</span>
              {i===0&&<div className="w-8 h-px bg-slate-200" />}
            </div>
          ))}
        </div>

        {step==='form' && (
          <form onSubmit={handleSubmit(d=>submitMutation.mutate(d))} className="space-y-4">

            {/* 1. Documentação */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <ST>1. Documentação Obrigatória</ST>
              <p className="text-xs font-semibold text-slate-500 mb-2">Empregado — marque os documentos que possui:</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <CB label="RG"                        {...register('doc_rg')} />
                <CB label="CPF"                       {...register('doc_cpf')} />
                <CB label="PIS/PASEP"                 {...register('doc_pis')} />
                <CB label="Título de Eleitor"         {...register('doc_titulo')} />
                <CB label="Comprovante de Residência" {...register('doc_residencia')} />
                <CB label="Cert. Reservista (Homens)" {...register('doc_reservista')} />
              </div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Comprovante de Escolaridade:</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <CB label="Escolar"   {...register('doc_escolar')} />
                <CB label="Faculdade" {...register('doc_faculdade')} />
              </div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Certidão:</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <CB label="Nascimento" {...register('doc_certidao_nasc')} />
                <CB label="Casamento"  {...register('doc_certidao_cas')} />
              </div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Dependentes — documentos que possui:</p>
              <div className="grid grid-cols-2 gap-2">
                <CB label="RG"                   {...register('dep_rg')} />
                <CB label="CPF"                  {...register('dep_cpf')} />
                <CB label="Certidão de Nasc."    {...register('dep_certidao')} />
                <CB label="Declaração Escolar"   {...register('dep_declaracao')} />
                <CB label="Comprovante Vacinação"{...register('dep_vacinacao')} />
              </div>
            </div>

            {/* 2. Contratação */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <ST>2. Dados da Contratação</ST>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FL label="Nome" req span2><I {...register('nome_empresa')} defaultValue={proc.candidate_name} /></FL>
                <FL label="Data de Admissão" req><I {...register('data_admissao')} type="date" /></FL>
                <FL label="Cargo" req><I {...register('cargo')} defaultValue={proc.position_name||''} /></FL>
                <FL label="Salário"><I {...register('salario')} placeholder="R$ 0,00" /></FL>
                <FL label="Experiência" span2><I {...register('experiencia')} placeholder="Descreva experiência anterior..." /></FL>
                <FL label="Tipo de Trabalho" span2>
                  <div className="flex gap-4"><CB label="Trabalho Urbano" {...register('tipo_urbano')} /><CB label="Trabalho Rural" {...register('tipo_rural')} /></div>
                </FL>
              </div>
            </div>

            {/* 3. Dados pessoais */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <ST>3. Dados do Empregado</ST>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FL label="Nome Completo" req span2><I {...register('full_name',{required:true})} defaultValue={proc.candidate_name} /></FL>
                <FL label="RG" req><I {...register('rg',{required:true})} placeholder="00.000.000-0" /></FL>
                <FL label="CPF" req><I {...register('cpf',{required:true})} placeholder="000.000.000-00" /></FL>
                <FL label="PIS/PASEP"><I {...register('pis_pasep')} placeholder="000.00000.00-0" /></FL>
                <FL label="Data de Nascimento" req><I {...register('birth_date',{required:true})} type="date" /></FL>
                <FL label="Sexo" req span2>
                  <div className="flex gap-6 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"><input type="radio" {...register('sexo',{required:true})} value="MASCULINO" className="accent-blue-600" />Masculino</label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"><input type="radio" {...register('sexo',{required:true})} value="FEMININO" className="accent-blue-600" />Feminino</label>
                  </div>
                </FL>
                <FL label="Nome da Mãe" req><I {...register('nome_mae',{required:true})} /></FL>
                <FL label="Nome do Pai"><I {...register('nome_pai')} /></FL>
                <FL label="Nacionalidade"><I {...register('nacionalidade')} defaultValue="Brasileira" /></FL>
                <FL label="Município de Nascimento"><I {...register('municipio_nascimento')} /></FL>
                <FL label="Raça/Cor">
                  <Sel {...register('raca_cor')}><option value="">Selecionar...</option>{RACAS.map(r=><option key={r}>{r}</option>)}</Sel>
                </FL>
                <FL label="Estado Civil">
                  <Sel {...register('estado_civil')}><option value="">Selecionar...</option>{EST_CIVIL.map(e=><option key={e}>{e}</option>)}</Sel>
                </FL>
                <FL label="Escolaridade" span2>
                  <Sel {...register('escolaridade')}><option value="">Selecionar...</option>{ESCOLAR.map(e=><option key={e}>{e}</option>)}</Sel>
                </FL>
                <FL label="" span2>
                  <div className="flex flex-wrap gap-4">
                    <CB label="Aposentado(a)"  {...register('aposentado')} />
                    <CB label="1° Emprego"      {...register('primeiro_emprego')} />
                    <CB label="Vale-Transporte" {...register('vale_transporte')} />
                  </div>
                </FL>

                {/* Título de Eleitor */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">Título de Eleitor</p>
                  <div className="grid grid-cols-3 gap-3">
                    <FL label="Número"><I {...register('titulo_numero')} placeholder="Nº" /></FL>
                    <FL label="Seção"> <I {...register('titulo_secao')}  placeholder="Seção" /></FL>
                    <FL label="Zona">  <I {...register('titulo_zona')}   placeholder="Zona" /></FL>
                  </div>
                </div>

                {/* CNH */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">CNH</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <FL label="Número">    <I {...register('cnh_numero')}    placeholder="Nº" /></FL>
                    <FL label="Categoria"> <I {...register('cnh_categoria')} placeholder="A/B..." /></FL>
                    <FL label="Órgão">     <I {...register('cnh_orgao')}     placeholder="DETRAN" /></FL>
                    <FL label="UF">        <I {...register('cnh_uf')}        placeholder="PR" maxLength={2} /></FL>
                    <FL label="Data Emissão"><I {...register('cnh_emissao')} type="date" /></FL>
                    <FL label="Validade">  <I {...register('cnh_validade')}  type="date" /></FL>
                    <FL label="1ª Emissão"><I {...register('cnh_1emissao')}  type="date" /></FL>
                  </div>
                </div>

                {/* Endereço */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">Endereço</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FL label="Endereço" req span2><I {...register('address',{required:true})} placeholder="Rua, número, complemento" /></FL>
                    <FL label="Bairro"><I {...register('bairro')} /></FL>
                    <FL label="Município"><I {...register('city')} defaultValue="Araucária" /></FL>
                    <FL label="CEP"><I {...register('zip_code')} placeholder="00000-000" /></FL>
                    <FL label="UF"><I {...register('state')} defaultValue="PR" maxLength={2} /></FL>
                    <FL label="Telefone" req><I {...register('phone',{required:true})} placeholder="(41) 00000-0000" /></FL>
                    <FL label="E-mail" req><I {...register('email',{required:true})} type="email" defaultValue={proc.candidate_email} /></FL>
                  </div>
                </div>

                {/* PCD */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <CB label="Possuo deficiência (PCD)" {...register('has_disability')} />
                  {watch('has_disability') && <div className="mt-2"><I {...register('disability_type')} placeholder="Tipo de deficiência" /></div>}
                </div>

                {/* Banco */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">Dados Bancários</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <FL label="Banco">  <I {...register('bank_code')}    placeholder="Ex: 001" /></FL>
                    <FL label="Agência"><I {...register('bank_agency')}  placeholder="0000-0" /></FL>
                    <FL label="Conta">  <I {...register('bank_account')} placeholder="00000-0" /></FL>
                    <FL label="Chave PIX" span2><I {...register('pix_key')} placeholder="CPF, email, celular ou chave aleatória" /></FL>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Dependentes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <ST>4. Dependentes</ST>
              <p className="text-xs text-slate-500 mb-4">Adicione apenas se possuir dependentes. Máximo 5.</p>
              {depFields.length===0 && <p className="text-sm text-center text-slate-400 py-4">Nenhum dependente adicionado.</p>}
              <div className="space-y-3">
                {depFields.map((field,idx)=>{
                  const open = openDeps.includes(idx);
                  return (
                    <div key={field.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 cursor-pointer bg-slate-50"
                        onClick={()=>setOpenDeps(o=>o.includes(idx)?o.filter(i=>i!==idx):[...o,idx])}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{idx+1}</span>
                          <span className="text-sm font-semibold text-slate-700">Dependente {idx+1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={e=>{e.stopPropagation();removeDep(idx);setOpenDeps(o=>o.filter(i=>i!==idx));}} className="p-1 rounded hover:bg-red-50 transition">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                          {open?<ChevronUp className="w-4 h-4 text-slate-400"/>:<ChevronDown className="w-4 h-4 text-slate-400"/>}
                        </div>
                      </div>
                      {open && (
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100">
                          <FL label="Nome Completo" req span2><I {...register(`dependentes.${idx}.nome`,{required:true})} /></FL>
                          <FL label="RG"><I {...register(`dependentes.${idx}.rg`)} placeholder="00.000.000-0" /></FL>
                          <FL label="CPF"><I {...register(`dependentes.${idx}.cpf`)} placeholder="000.000.000-00" /></FL>
                          <FL label="Data de Nascimento" req><I {...register(`dependentes.${idx}.birth_date`,{required:true})} type="date" /></FL>
                          <FL label="Sexo">
                            <div className="flex gap-4 pt-1">
                              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"><input type="radio" {...register(`dependentes.${idx}.sexo`)} value="MASCULINO" className="accent-blue-600"/>Masculino</label>
                              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"><input type="radio" {...register(`dependentes.${idx}.sexo`)} value="FEMININO" className="accent-blue-600"/>Feminino</label>
                            </div>
                          </FL>
                          <FL label="" span2>
                            <div className="flex flex-wrap gap-4">
                              <CB label="Dependente para IRRF" {...register(`dependentes.${idx}.irrf`)} />
                              <CB label="Matriculado(a)"       {...register(`dependentes.${idx}.matriculado`)} />
                            </div>
                          </FL>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {depFields.length<5 && (
                <button type="button"
                  onClick={()=>{appendDep({nome:'',rg:'',cpf:'',birth_date:'',sexo:'',irrf:false,matriculado:false});setOpenDeps(o=>[...o,depFields.length]);}}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition">
                  <Plus className="w-4 h-4" />Adicionar dependente
                </button>
              )}
            </div>

            {/* Declaração */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
              <strong>Declaração:</strong> Declaro que as informações constantes neste formulário são fiéis à verdade e condizentes com a realidade dos fatos. Todas as informações foram extraídas de meus documentos originais, sendo de minha inteira responsabilidade. Fico ciente de que falsidade das informações configura crime previsto no Código Penal Brasileiro.
            </div>

            <button type="submit" disabled={isSubmitting||submitMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm">
              {submitMutation.isPending?<><Loader2 className="w-4 h-4 animate-spin"/>Salvando...</>:'Confirmar dados e continuar →'}
            </button>
          </form>
        )}

        {step==='docs' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Dados registrados!</h2>
                <p className="text-sm text-slate-500">Agora envie os documentos solicitados.</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">Formatos aceitos: PDF, JPG, PNG (máx. 10MB cada).</p>
            <div className="space-y-2.5">
              {(proc.documents||[]).map((doc: any)=>(
                <DocUpload key={doc.id} doc={doc} token={params.token} />
              ))}
            </div>
            <button onClick={()=>setStep('done')} className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition">
              Concluir envio ✓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DocUpload({ doc, token }: { doc: any; token: string }) {
  const [uploaded, setUploaded]   = useState(doc.status==='ENVIADO'||doc.status==='APROVADO');
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if(!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append('file', file);
      await api.post(`/admissions/upload/${token}/${doc.id}`, form, { headers:{'Content-Type':'multipart/form-data'} });
      setUploaded(true); toast.success(`${doc.type} enviado!`);
    } catch { toast.error('Erro ao enviar arquivo.'); }
    finally { setUploading(false); }
  };
  return (
    <div className={`flex items-center justify-between p-3.5 rounded-xl border transition ${uploaded?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-3">
        {uploaded?<CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0"/>:<Upload className="w-5 h-5 text-slate-400 shrink-0"/>}
        <div>
          <p className="text-sm font-medium text-slate-700">{doc.type}</p>
          {doc.required&&!uploaded&&<p className="text-xs text-red-400">Obrigatório</p>}
          {uploaded&&<p className="text-xs text-emerald-600">Enviado ✓</p>}
        </div>
      </div>
      {!uploaded&&(
        <label className={`cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg transition ${uploading?'text-slate-400':'text-blue-600 hover:bg-blue-50'}`}>
          {uploading?<Loader2 className="w-4 h-4 animate-spin inline"/>:'Enviar'}
          <input type="file" className="hidden" disabled={uploading} accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile}/>
        </label>
      )}
    </div>
  );
}

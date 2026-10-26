/**
 * Materiais gratuitos da MF (antes nas páginas do Bitrix:
 * materiais.bitrix24.site/baixarmanuais, /baixarblocos e /tutoriaisMF).
 *
 * Os arquivos ficam no Google Drive da MF; as fotos vieram do Bitrix e são
 * copiadas para a AURA por /api/site/materiais/importar (enquanto não forem
 * copiadas, a página usa o endereço antigo).
 */

export type GrupoModelo = "Embutidas" | "Suspensas" | "Expostas";

export interface ModeloMaterial {
  grupo: GrupoModelo;
  nome: string;
  /** Link do arquivo (Drive). Sem link: pedir pelo WhatsApp. */
  url: string | null;
  imagem: string;
}

export interface Tutorial {
  grupo: string;
  titulo: string;
  texto: string;
  /** Id do vídeo no YouTube. */
  video: string;
}

export const CDN_BITRIX = "https://cdn.bitrix24.com.br/b28173705/landing/";
export const GRUPOS: GrupoModelo[] = ["Embutidas", "Suspensas", "Expostas"];

export const WHATSAPP_MF = "555135361422";
export const TELEFONE_MF = "(51) 3536-1422";
export const LOGO_MF = CDN_BITRIX + "973/97305c65109aaf52e1b57b409fe2723c/mf_branco_1x.png";

/** Catálogo MF 2025 (PDF no Drive da MF, aberto para quem tem o link). */
export const CATALOGO_URL = "https://drive.google.com/file/d/1-7itT7rEv2tSpMgvHIIWOyxAUfQM0ZBn/view";

/** Fotos do topo de cada página. */
export const FUNDOS = {
  materiais: CDN_BITRIX + "123/123cadf9605d69a3b1811ca15fa0a237/montagem_m_ltiplos_cat_logos_2_1x.jpg",
  manuais: CDN_BITRIX + "8f2/8f285bee4d07077bede39419036f0b93/manuais_1x.jpeg",
  blocos: CDN_BITRIX + "625/6253575fa12d6cbf946cdc82ec101cf0/yy71hbcuu1_1x.jpeg",
  tutoriais: CDN_BITRIX + "482/482378a4b9f184683ea149929f774d29/design_sem_nome_11_1x.png",
};

type Linha = [GrupoModelo, string, string | null, string];
const montar = (linhas: Linha[]): ModeloMaterial[] =>
  linhas.map(([grupo, nome, url, imagem]) => ({ grupo, nome, url, imagem: CDN_BITRIX + imagem }));

export const MANUAIS = montar([
  ["Embutidas", "Vision", "https://drive.google.com/file/d/1OcrD5gvP3E1zClYyVgr--uQGDefibGmM/view", "82b/82b55c9a1f9c891148e043c64e676c35/vision_nova_3_1x.png"],
  ["Embutidas", "Vitro", "https://drive.google.com/file/d/1P5pABF8KH7_Apt2UGt-WCh18u0iys7_W/view", "639/6396436747485b98b48abb4225b1313f/mf_vitro_esq_3_1x.png"],
  ["Embutidas", "Prime Duo", null, "c96/c96e911885481ba512daf0df6252f7ea/prime_duo_emb_1x.png"],
  ["Embutidas", "Wide Duo", "https://drive.google.com/file/d/1cgn_Ga4Pls5S_tb3vd2XwP0mcM1FN3dz/view", "dd4/dd442009f5afcab35ae9a761dca4a3df/wide_duo_1x.png"],
  ["Embutidas", "Duo", "https://drive.google.com/file/d/1LTSPl_Sg7uXOHHZo3kkSwvfCOhXZXt1s/view", "975/975cc4fdac69219f72e567bbe0363970/duo_embutida_4_lados_1x.png"],
  ["Embutidas", "Prime", "https://drive.google.com/file/d/15wVo8fvPJdC7SrRnpnC8wAPLTdiPLRlh/view", "87b/87bc357f74bbd24ed41ae860f7411920/prime_100_1x.png"],
  ["Embutidas", "Wide 120", "https://drive.google.com/file/d/1YxCbszExTCt3e9hWmJFeuVDXQGCDOiWT/view", "4b5/4b5e9984fa9aa8ff3b0f6af4ccb34037/wide_120_1x.png"],
  ["Embutidas", "Altezza", "https://drive.google.com/file/d/1kbm4oF30AkurHJO5WxwSA-e9RFVc9Rs-/view", "ee6/ee6ca3db50f6e73a27ade243f7ac3bbd/altezza_1x.png"],
  ["Embutidas", "Adatto", "https://drive.google.com/file/d/1mpkrT8lcaeRwDaJ8VqgthagiMPuHHDQO/view", "9b5/9b5ca803510ac9e79a717171bf553719/adaatto_1x.png"],
  ["Embutidas", "Adatto Pro", "https://drive.google.com/drive/folders/1L1JjYKDDWZd3zDM4vh3dv9f46rgF_Rb0", "cfa/cfa8b2055792d596a57a7dbfe2292f20/adatto110_3l_embutida_1x.png"],
  ["Embutidas", "MF 1400", "https://drive.google.com/file/d/1DyCCMghx7X9rNOjtKn15XqUrX4XCJ2pq/view", "b7d/b7db37487ca18359fd7ec4b6538763d2/1400_1x.png"],
  ["Embutidas", "MF 1200", "https://drive.google.com/file/d/1GgW91kBBtBV7Dp5sBvUYx12kFsNm-u3Q/view", "84d/84d35ab4b142ed2f8b0aee50e9a1007c/1200_1x.png"],
  ["Embutidas", "Evo Fire", null, "252/252110ca16777b8ea59a86241ddce86f/captura_de_tela_2025_05_19_102207_1x.png"],
  ["Suspensas", "MF 360", "https://drive.google.com/file/d/1cFU_bdRTUTbpp0oQrW_h6NbVra33LMbT/view", "e3a/e3a86c62794bb90b17308099767c543f/design_sem_nome_15_1x.png"],
  ["Suspensas", "MF Orbit", null, "89a/89afe6d701caa04aa9f0190e97286f41/design_sem_nome_17_1x.png"],
  ["Suspensas", "MF Ottanta", null, "41f/41f487fd884a5ad0c3c5bf3710d3b8ce/design_sem_nome_12_1x.png"],
  ["Expostas", "Prime Duo", null, "886/8863713a176e16bd032e29ccacddcbfc/prime_duo_exp_1x.png"],
  ["Expostas", "Wide Duo", "https://drive.google.com/file/d/1cgn_Ga4Pls5S_tb3vd2XwP0mcM1FN3dz/view", "ca5/ca5d4da3342b7afba4fb85c78621daa9/wide_duo_exposta_com_pedestal_1x.png"],
  ["Expostas", "Duo", "https://drive.google.com/file/d/1LTSPl_Sg7uXOHHZo3kkSwvfCOhXZXt1s/view", "bc2/bc2fdeaa08d3bb8b8e7c08025b2d71f8/duo_exposta_4_lados_1x.png"],
  ["Expostas", "Efficienza", "https://drive.google.com/file/d/1VRTxKf5ptMICgYuJYcK3-lb-Ucj4VKSi/view", "92c/92c9ee492bca5580d15ffeb623fe56b6/efienzza_1x.png"],
  ["Expostas", "MF 1400", "https://drive.google.com/file/d/1PuaIHBrdjam-HGMctCvJ6M6YTnkcaGh3/view", "d0a/d0a2f68033b49c55c2825dc7c73bfba6/1410_1x.png"],
  ["Expostas", "MF 1200", "https://drive.google.com/file/d/16JD3OZSnf9cCIQZh-tLGdzR2sDIFHC7k/view", "96d/96d5226f9a0f3d5e8ea3e5536a66f6a3/1210_1x.png"],
  ["Expostas", "Forza", "https://drive.google.com/file/d/1wvZYx7PDsCqZE9PrJsYbDjGVvkTYtvzL/view", "7a0/7a0d41c59bc92914e691a57255512da6/forza_1x.png"],
  ["Expostas", "Adatto", "https://drive.google.com/file/d/1mpkrT8lcaeRwDaJ8VqgthagiMPuHHDQO/view", "797/797410e1041be354a94e6e120e2bcfa8/ada_ex_1x.png"],
  ["Expostas", "Adatto Pro", "https://drive.google.com/drive/folders/1L1JjYKDDWZd3zDM4vh3dv9f46rgF_Rb0", "c21/c213431fcc00cde99941a238d3bf90be/adatto110_3l_exposta_1x.png"],
  ["Expostas", "Fogo Pro", "https://drive.google.com/file/d/1KK3Z2CX6AxmWJ43Lib1BWOGymIyStdE6/view", "66c/66c8a374fedff67e342e859920eb2656/fgopro_1x.png"],
  ["Expostas", "MF 350", "https://drive.google.com/file/d/16dMCa-Q_obArn9anhbegBurbjH_ykx5C/view", "4da/4da0217728d63741a11d2cd5da65abe8/mf_350_1x.png"],
  ["Expostas", "Fire Pro", "https://drive.google.com/file/d/1Eir8p2dRvmYTyI2Nb-6e_kNhSel2f8bD/view", "198/19894cdf227e8d42d21d52d5e92a6422/firepro_1x.png"],
  ["Expostas", "Delicatta", "https://drive.google.com/file/d/100Qj-GCRKcO9kcvxHE98S_a4zo8kZUN0/view", "d7a/d7aa49493d6dc2ac6533143e41640ba9/dellicata_1x.png"],
  ["Expostas", "MF 250", "https://drive.google.com/file/d/1LDS6IsZ2AvhkitAYMAWxXMHvkLKRJnnr/view", "bd9/bd98c27e3726fb37f63ae02097ddf868/250_1x.png"],
  ["Expostas", "MF 150", "https://drive.google.com/file/d/1v0sLA3q50SdyW0k1kavhvF5qlt2-Z9Vw/view", "164/1646015ce0736b52a49efa04c8e484fa/150_1x.png"],
]);

export const BLOCOS = montar([
  ["Embutidas", "Vision", "https://drive.google.com/drive/folders/1dLANexhwYMiSQpDc07Mv6alp94UlZkbd", "090/0908e86a01a1e4640925864d6bf65ef4/vision_1x.png"],
  ["Embutidas", "Vitro direita/esquerda", "https://drive.google.com/drive/folders/1S8n5b8Dq0CZuqPp4Ceg-IDSXCrlal_5x", "218/218be1ea1b3c40dbd733535aeac534cb/vitro_direita_1x.png"],
  ["Embutidas", "Prime Duo", "https://drive.google.com/drive/folders/1M-HPv3pMfccSKzH0tOw1gTzI8onS357L", "2ce/2ce161014d2e6386507b45fcc792abc5/prime_duo_1x.png"],
  ["Embutidas", "Wide Duo", "https://drive.google.com/drive/folders/1z34aPjHt1Hun_00LyxsR8f_O07DiYDMY", "dd4/dd442009f5afcab35ae9a761dca4a3df/wide_duo_1x.png"],
  ["Embutidas", "Duo", "https://drive.google.com/drive/folders/1-1GYDdaqSpWcUnqeaj3RSsbPeszE4S93", "0b1/0b10a45a26a7b95c86652a67f22ef0bb/duo_embutida_1x.png"],
  ["Embutidas", "Duo direita/esquerda", "https://drive.google.com/drive/folders/1-1GYDdaqSpWcUnqeaj3RSsbPeszE4S93", "9c5/9c57e9a2f84cfd9a822fb74eb39e1728/duo_lado_direito_esquerdo_1x.png"],
  ["Embutidas", "Duo Pro 4 lados", "https://drive.google.com/drive/folders/1-1GYDdaqSpWcUnqeaj3RSsbPeszE4S93", "882/8829b9500fe9339782c937337d9f7c62/duo_4p_embutida_1x.png"],
  ["Embutidas", "Prime 100", "https://drive.google.com/drive/folders/1eSM0Yi1ievavXcz-RnAM-95t-JzvbcIK", "87b/87bc357f74bbd24ed41ae860f7411920/prime_100_1x.png"],
  ["Embutidas", "Prime 80", "https://drive.google.com/drive/folders/13Db2irUBFhHX-IjgH7wnqY964GUoY8Ag", "7ea/7eaa8b7b26c2790e8559ad683cee8360/prime_80_embutida_1x.png"],
  ["Embutidas", "Wide 120", "https://drive.google.com/drive/folders/1cZyfwuQGztqRn1DPTO0kWhdIkeotsQvz", "4b5/4b5e9984fa9aa8ff3b0f6af4ccb34037/wide_120_1x.png"],
  ["Embutidas", "Altezza", "https://drive.google.com/drive/folders/1sV_BbBgnOblVcIj1KsP1Ei3YIX3z3SBi", "ee6/ee6ca3db50f6e73a27ade243f7ac3bbd/altezza_1x.png"],
  ["Embutidas", "Adatto 110", "https://drive.google.com/drive/folders/1qjpFkxgdexcQTpPPRQDVM87nTptN9l6p", "2ca/2ca72e0b69f715ffd1808e72c410e01d/adatto_110_em_1x.png"],
  ["Embutidas", "Adatto 110 direita/esquerda", "https://drive.google.com/drive/folders/1KYlyqmUhdbertOMaTxCh3n_zMU-vTxTF", "270/270ec86c8a1d92c1385a57901781680a/adatto_110_direito_1x.png"],
  ["Embutidas", "Adatto 110 3 faces", "https://drive.google.com/drive/folders/18FKm_7D4mUxfsgUQBIU1QpMQ_Eus1thL", "c95/c95c71e501e2a521cc80ae9faadb5312/adatto_110_3_lados_1x.png"],
  ["Embutidas", "Adatto 90", "https://drive.google.com/drive/folders/1e6iT5KGiusqq1d8nQEw8eaPPlP03qFaS", "448/4486948875cadb5d37537be9ea0f159b/adatto_90_embutida_1x.png"],
  ["Embutidas", "Adatto 90 direita/esquerda", "https://drive.google.com/drive/folders/1jyyRUgR81dAcYdOuW2B_opO3q3bZII6p", "a2b/a2bcf4286bbeb7179eb9039db850c58f/adatto_90_pro_d_embutida_1x.png"],
  ["Embutidas", "Adatto 90 3 faces", "https://drive.google.com/drive/folders/1UM_eU1e-JDq1r2J7ECfYdN20MQYFoYmk", "236/23640e0063fbcfa74b2bfc0555aaffc4/adatto90_3l_embutida_1x.png"],
  ["Embutidas", "Adatto 70", "https://drive.google.com/drive/folders/1lbWFylJ43XBsKYMi8IzFRp3uiVTSmS8u", "967/967eed3152b556cc62801cd48d345ba3/adatto_70_embutida_1x.png"],
  ["Embutidas", "Adatto 70 direita/esquerda", "https://drive.google.com/drive/folders/1uhMHpNJxf9z06PEp6hSas3SUThWZwL21", "731/731ced7cf89f8bf88e4f56783a18423b/adatto_70_pro_d_embutida_1x.png"],
  ["Embutidas", "Adatto 70 3 faces", "https://drive.google.com/drive/folders/18vPgIORJ4mzsya9BKjAwjLWaUaRc0n8W", "2e6/2e627483544d76448be7187705808946/adatto70_3l_embutida_nova_1x.png"],
  ["Embutidas", "Adatto 55", "https://drive.google.com/drive/folders/1oxSvJJTZtpzMITaGGMyvCzBdlJsbl3fO", "adb/adbffc845747048096b76476824a4b1c/adatto_55_embutida_1x.png"],
  ["Embutidas", "Adatto 55 direita/esquerda", "https://drive.google.com/drive/folders/1VZkgbk8BB4vcgunI-jfXb0tCKQzb0CmK", "084/0842462c18f8fe6175cfa5fc1f9b3e10/adatto_55_pro_d_embutida_1x.png"],
  ["Embutidas", "Adatto 55 3 faces", "https://drive.google.com/drive/folders/1aF9BMj6jIu8kNJDsoeX4B12Jk1E9s0Zw", "5b1/5b1ca151c63b36846bf9f55228f933cf/adatto55_3l_embutida_1x.png"],
  ["Embutidas", "MF 1400", "https://drive.google.com/drive/folders/1BCdp-5uxdcN1vsbqPA2etDmtIy7bsjOJ", "b7d/b7db37487ca18359fd7ec4b6538763d2/1400_1x.png"],
  ["Embutidas", "MF 1200", "https://drive.google.com/drive/folders/19BIg5AkvaOAzZRUpICsa6DOFx16OUIXj", "84d/84d35ab4b142ed2f8b0aee50e9a1007c/1200_1x.png"],
  ["Embutidas", "Evo Fire", null, "a62/a6293f3b92608a982a27c309d0317c0d/design_sem_nome_14_1x.png"],
  ["Suspensas", "MF 360", "https://drive.google.com/drive/folders/1JroG378oR9B_6XY1_fBlNMWawjgyycz0", "e3a/e3a86c62794bb90b17308099767c543f/design_sem_nome_15_1x.png"],
  ["Suspensas", "MF Orbit", null, "89a/89afe6d701caa04aa9f0190e97286f41/design_sem_nome_17_1x.png"],
  ["Suspensas", "MF Ottanta", null, "176/1765c6826e747c09313af268a4242f86/design_sem_nome_16_1x.png"],
  ["Expostas", "Prime Duo", "https://drive.google.com/drive/folders/1M-HPv3pMfccSKzH0tOw1gTzI8onS357L", "886/8863713a176e16bd032e29ccacddcbfc/prime_duo_exp_1x.png"],
  ["Expostas", "Wide Duo", "https://drive.google.com/drive/folders/1z34aPjHt1Hun_00LyxsR8f_O07DiYDMY", "ca5/ca5d4da3342b7afba4fb85c78621daa9/wide_duo_exposta_com_pedestal_1x.png"],
  ["Expostas", "Duo", "https://drive.google.com/drive/folders/1c83WDmDJJ0yd0ZQBWpZZSQ-bY70v9Ard", "7b5/7b54e8c7de5a325d3233ce5f073cd269/duo_exposta_1x.png"],
  ["Expostas", "Duo direita/esquerda", "https://drive.google.com/drive/folders/15ut7-k--iawD1lEYO0dqS9VJT1FwwuKV", "757/75709c231aa256cf0a265ed9c6dc0de4/duo_exposta_lado_esquerdo_1x.png"],
  ["Expostas", "Duo Pro 4 lados", "https://drive.google.com/drive/folders/15ut7-k--iawD1lEYO0dqS9VJT1FwwuKV", "bc2/bc2fdeaa08d3bb8b8e7c08025b2d71f8/duo_exposta_4_lados_1x.png"],
  ["Expostas", "Efficienza", "https://drive.google.com/drive/folders/1cV6PP8MFRkrcn4b1Jtf02kzGvImy_tjR", "4a3/4a39f1dc1fca45efac9085a5c35fe858/efficienza_1x.png"],
  ["Expostas", "MF 1400", "https://drive.google.com/drive/folders/1BCdp-5uxdcN1vsbqPA2etDmtIy7bsjOJ", "c8c/c8cc4023e1428ea89acc9b8fe74065f8/1400_ex_1x.png"],
  ["Expostas", "MF 1200", "https://drive.google.com/drive/folders/19BIg5AkvaOAzZRUpICsa6DOFx16OUIXj", "e93/e9361a40bb7b542f02426e07929871c7/1200_ex_1x.png"],
  ["Expostas", "Forza", "https://drive.google.com/drive/folders/19p5LfR6uDE7beJq2SNNUs3EU1L4ZOKnU", "63c/63c0e119a5a1a41997a229acaec541f8/forza_1x.png"],
  ["Expostas", "Adatto 110", "https://drive.google.com/drive/folders/1qjpFkxgdexcQTpPPRQDVM87nTptN9l6p", "f07/f0719867c62e2568d9592162ad467051/110_ex_1x.png"],
  ["Expostas", "Adatto 110 direita/esquerda", "https://drive.google.com/drive/folders/1KYlyqmUhdbertOMaTxCh3n_zMU-vTxTF", "9a9/9a9fa1b800d4435403af57d050ae8774/adatto_110_pro_e_exposta_1x.png"],
  ["Expostas", "Adatto 110 3 faces", "https://drive.google.com/drive/folders/18FKm_7D4mUxfsgUQBIU1QpMQ_Eus1thL", "c21/c213431fcc00cde99941a238d3bf90be/adatto110_3l_exposta_1x.png"],
  ["Expostas", "Adatto 90", "https://drive.google.com/drive/folders/1e6iT5KGiusqq1d8nQEw8eaPPlP03qFaS", "ab5/ab5840eadaa7d6a2565d9d8181c83845/adatto_90_ex_1x.png"],
  ["Expostas", "Adatto 90 direita/esquerda", "https://drive.google.com/drive/folders/1jyyRUgR81dAcYdOuW2B_opO3q3bZII6p", "231/231c18515d4ade0d8cb8d19be15ee109/adatto_90_pro_e_exposta_1x.png"],
  ["Expostas", "Adatto 90 3 faces", "https://drive.google.com/drive/folders/1UM_eU1e-JDq1r2J7ECfYdN20MQYFoYmk", "106/106210cb0b84304c0d9dc511632d719f/adatto90_3l_exposta_1x.png"],
  ["Expostas", "Adatto 70", "https://drive.google.com/drive/folders/1lbWFylJ43XBsKYMi8IzFRp3uiVTSmS8u", "599/5992fc11f191cd8b0f8735ff6ba9ad05/adatto_70_ex_1x.png"],
  ["Expostas", "Adatto 70 direita/esquerda", "https://drive.google.com/drive/folders/1uhMHpNJxf9z06PEp6hSas3SUThWZwL21", "029/029779cfdd80f3df0e79e912e085955f/adatto_70_pro_e_exposta_1x.png"],
  ["Expostas", "Adatto 70 3 faces", "https://drive.google.com/drive/folders/18vPgIORJ4mzsya9BKjAwjLWaUaRc0n8W", "b6a/b6ad6f12c98fff734d5e345b7b6b39b7/adatto70_3l_exposta_1x.png"],
  ["Expostas", "Adatto 55", "https://drive.google.com/drive/folders/1oxSvJJTZtpzMITaGGMyvCzBdlJsbl3fO", "a97/a97e24b0323d41f36bd4a95ecf66d15c/adatto_55_ex_1x.png"],
  ["Expostas", "Adatto 55 direita/esquerda", "https://drive.google.com/drive/folders/1VZkgbk8BB4vcgunI-jfXb0tCKQzb0CmK", "5a5/5a5bcab34437a0d56f407ca3c415e5bd/adatto_55_pro_e_exposta_1x.png"],
  ["Expostas", "Adatto 55 3 faces", "https://drive.google.com/drive/folders/1aF9BMj6jIu8kNJDsoeX4B12Jk1E9s0Zw", "d46/d469f9726e3daecd2c049bd1d3408d11/adatto55_3l_exposta_1x.png"],
  ["Expostas", "Fogo Pro", "https://drive.google.com/drive/folders/1WmMbr39RJBGJEnODQH1RD4QQjsSHJkT1", "9a0/9a07042be384da3ffd8f60ffae082d4b/fogo_pro_1x.png"],
  ["Expostas", "MF 350", "https://drive.google.com/drive/folders/1dZoGpnrLokxL2VmXFYsrEjPHEtaLU9R3", "3f4/3f4a84292f5579e693ded6a061d909ec/mf_350_1x.png"],
  ["Expostas", "Fire Pro", "https://drive.google.com/drive/folders/10JzhotLvG-90Es8OxvWxZBxO07opoWm2", "cf8/cf8db9ddfc5284c836a540554641abbb/firepro_1x.png"],
  ["Expostas", "Delicatta di Canto", "https://drive.google.com/drive/folders/1dQAHvtL-VzUv325r3zM7aIVv4zXARRMF", "ee5/ee5bb9d1c0ba3388fc5c88763e4e89bd/delicatta_dicanto_1x.png"],
  ["Expostas", "Delicatta", "https://drive.google.com/drive/folders/1nF7drrlgzp4LFOiDRtQ0UFIOZXDCOb_b", "ef2/ef2ba485fb6ce80b13930f7c6e0e3d3d/dellicata_1x.png"],
  ["Expostas", "MF 250", "https://drive.google.com/drive/folders/1PEwkuljDvquYoukpvVJdIR3SLKom0y8n", "644/6447225c423a480ff4ae74aef40254d6/250_1x.png"],
  ["Expostas", "MF 150", "https://drive.google.com/drive/folders/1dWfN7x_Om9cN1OuaRXQNZqWOuDxOhnJp", "164/1646015ce0736b52a49efa04c8e484fa/150_1x.png"],
]);

export const TUTORIAIS: Tutorial[] = [
  { grupo: "Instalação e ajustes", titulo: "Como instalar molduras nas lareiras MF – linha Adatto", texto: "Aprenda o passo a passo para a instalação correta das molduras da linha Adatto, garantindo acabamento perfeito e segurança.", video: "TFLURdGyr9s" },
  { grupo: "Instalação e ajustes", titulo: "Como instalar corretamente uma lareira – dicas MF International", texto: "Orientações técnicas essenciais para uma instalação correta, segura e com máximo desempenho térmico.", video: "ZWPisBVKE_8" },
  { grupo: "Lenha e desempenho", titulo: "Como a umidade da lenha afeta o poder calorífico da sua lareira", texto: "Entenda por que a escolha da lenha correta influencia diretamente no aquecimento, na economia e na durabilidade da lareira.", video: "pcGrn5p1H4w" },
  { grupo: "Lenha e desempenho", titulo: "3 tipos de lenha para lareiras de alto rendimento", texto: "Conheça as melhores opções de lenha para obter mais calor, menos fumaça e melhor combustão.", video: "5jraOxfMPLo" },
  { grupo: "Acendimento e controle do fogo", titulo: "Como fazer fogo na sua lareira de alto rendimento", texto: "Dicas práticas para acender sua lareira com facilidade, eficiência e segurança.", video: "hxoygGKWPf4" },
  { grupo: "Acendimento e controle do fogo", titulo: "Acendendo uma lareira de alta performance com facilidade e segurança", texto: "Técnicas corretas de acendimento que melhoram o desempenho e reduzem resíduos.", video: "oN-W1KYKyAk" },
  { grupo: "Acendimento e controle do fogo", titulo: "Controlando o fogo pelas entradas de oxigênio", texto: "Aprenda a controlar a intensidade do fogo, o consumo de lenha e a temperatura do ambiente.", video: "oRdl50cjA0w" },
  { grupo: "Manutenção e limpeza", titulo: "Como funciona a manutenção de uma lareira", texto: "Saiba quais cuidados são necessários para manter sua lareira sempre eficiente e segura.", video: "BonjZ8jZUi8" },
  { grupo: "Manutenção e limpeza", titulo: "Como limpar o vidro da lareira com as cinzas", texto: "Uma técnica simples, econômica e eficaz para manter o vidro sempre limpo.", video: "NxN7AG3QGbc" },
  { grupo: "Manutenção e limpeza", titulo: "Como limpar o vidro com o Limpa-Vidros MF", texto: "Demonstração do produto ideal para uma limpeza rápida e sem esforço.", video: "rG10HkNNIzk" },
];

/** Todas as fotos que vieram do Bitrix (para copiar para a AURA). */
export function fotosDoBitrix(): string[] {
  const todas = [LOGO_MF, ...Object.values(FUNDOS), ...MANUAIS.map((m) => m.imagem), ...BLOCOS.map((m) => m.imagem)];
  return [...new Set(todas)];
}

/**
 * Onde a foto fica na pasta pública "site" depois de copiada:
 * materiais/<8 letras da pasta do Bitrix>-<nome>.webp (o logo fica em png).
 */
export function caminhoDaCopia(url: string): string | null {
  if (!url.startsWith(CDN_BITRIX)) return null;
  const partes = url.slice(CDN_BITRIX.length).split("/");
  if (partes.length < 3) return null;
  const nome = partes[2].replace(/\.[a-z0-9]+$/i, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const ext = url === LOGO_MF ? "png" : "webp";
  return `materiais/${partes[1].slice(0, 8)}-${nome}.${ext}`;
}

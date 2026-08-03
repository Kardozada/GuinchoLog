import { Vehicle, User, UserRole } from './types';

// ==============================================================================
// 1. CONFIGURAÇÃO DA PLANILHA (Obrigatório)
// Cole a URL que você copiou do Google Apps Script (Deploy > Web App) abaixo.
// Deve começar com 'https://script.google.com/macros/s/...'
export const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwi5IFzi0OxhCHeAS5h92ixZ941au8e_5ShnjYSGZrswe4iVWCUbre2x5Qm9YEJMmlU/exec'; 
// ==============================================================================

// Excluded VTRs numbers based on user request
const EXCLUDED_VTRS = [13, 20, 25, 42];

// Generate Vehicles based on user requirements: 45 VTR, 3 Cars, 2 Motos, ordered cars/motos first
export const VEHICLES: Vehicle[] = [
  { id: 'car-argo', name: 'Argo', type: 'CARRO' },
  { id: 'car-doblo', name: 'Doblô', type: 'CARRO' },
  { id: 'car-byd', name: 'BYD Dolphin', type: 'CARRO' },

  ...Array.from({ length: 2 }, (_, i) => ({ id: `moto-${i+1}`, name: `Moto Apoio ${i+1}`, type: 'MOTO' as const })),

  ...Array.from({ length: 45 }, (_, i) => i + 1)
    .filter(num => !EXCLUDED_VTRS.includes(num))
    .map(num => ({ id: `vtr-${num}`, name: `VTR ${num}`, type: 'VTR' as const })),
];

// ==============================================================================
// 2. CADASTRO DE ADMINISTRADORES
// Acesso total ao Dashboard. Login via EMAIL ou CPF.
// ==============================================================================
export const MOCK_ADMINS: User[] = [
  { 
    id: 'admin-1', 
    name: 'Hudson Haendel', 
    cpf: '092.291.904-62', 
    email: 'hudson.haendel@guincholog.com', 
    role: UserRole.ADMIN, 
    avatarUrl: 'https://ui-avatars.com/api/?name=Hudson+Haendel&background=0D8ABC&color=fff' 
  },
  { 
    id: 'admin-2', 
    name: 'Andre Estevam', 
    cpf: '010.727.684-45', 
    email: 'andre.estevam@guincholog.com', 
    role: UserRole.ADMIN, 
    avatarUrl: 'https://ui-avatars.com/api/?name=Andre+Estevam&background=0D8ABC&color=fff' 
  },
  { 
    id: 'admin-3', 
    name: 'Matheus Cardoso', 
    cpf: '162.908.227-99', 
    email: 'matheus.cardoso@guincholog.com', 
    role: UserRole.ADMIN, 
    avatarUrl: 'https://ui-avatars.com/api/?name=Matheus+Cardoso&background=0D8ABC&color=fff' 
  },
  { 
    id: 'admin-4', 
    name: 'Karla Cristina', 
    cpf: '010.598.594-59', 
    email: 'karla.cristina@guincholog.com', 
    role: UserRole.ADMIN, 
    avatarUrl: 'https://ui-avatars.com/api/?name=Karla+Cristina&background=0D8ABC&color=fff' 
  }
];

// ==============================================================================
// 3. CADASTRO DE MOTORISTAS
// Lista oficial de motoristas. Login via EMAIL ou CPF.
// ==============================================================================
export const MOCK_DRIVERS: User[] = [
  { id: 'd1', name: 'ADRIANO BARBOSA DA SILVA', cpf: '092.511.684-07', email: 'Adrianobabosa622@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Adriano+Barbosa&background=random' },
  { id: 'd4', name: 'ALEF DA SILVA APOLINARIO', cpf: '085.985.984-37', email: 'alef.apolinarioo@hotmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Alef+Silva&background=random' },
  { id: 'd5', name: 'ALEXSANDRO BARBOSA DA SILVA', cpf: '069.646.034-33', email: 'AlexsandroBarbosadasilva953@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Alexsandro+Barbosa&background=random' },
  { id: 'd6', name: 'ALLAN JUDSON DA SILVA DE MELO', cpf: '706.755.944-80', email: 'allanjudson32@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Allan+Judson&background=random' },
  { id: 'd8', name: 'ANDERSON KLEYTON DA SILVA', cpf: '071.678.294-47', email: 'silva_kleyton@hotmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Anderson+Kleyton&background=random' },
  { id: 'd9', name: 'ANTONIO CARLOS BEZERRA CIRINO', cpf: '500.649.084-53', email: 'antonio.27.cbc@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Antonio+Carlos&background=random' },
  { id: 'd10', name: 'CLAUDIO AQUINO DA SILVA', cpf: '008.299.424-24', email: 'claudio4claudioju@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Claudio+Aquino&background=random' },
  { id: 'd11', name: 'DAMIAO CORREIA DE LIMA SOBRINHO SILVA', cpf: '017.070.384-30', email: 'dinholima311290@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Damiao+Correia&background=random' },
  { id: 'd12', name: 'DARIO PEREIRA DE LIMA', cpf: '751.368.484-72', email: 'pdario.dp@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Dario+Pereira&background=random' },
  { id: 'd13', name: 'DAVID CUNHA DE SOUZA', cpf: '214.637.194-34', email: 'david50cunha@hotmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=David+Cunha&background=random' },
  { id: 'd14', name: 'DIEGO WAGNER DA SILVA LINHARES', cpf: '097.430.714-90', email: 'diego.linhares883356@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Diego+Wagner&background=random' },
  { id: 'd15', name: 'DJAVAN GOMES DA SILVA', cpf: '082.239.224-01', email: 'djavansilva56983@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Djavan+Gomes&background=random' },
  { id: 'd16', name: 'DOUGLAS BARBOSA COSTA', cpf: '709.078.884-96', email: 'douglascosta780@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Douglas+Barbosa&background=random' },
  { id: 'd17', name: 'EDSON GOMES DO NASCIMENTO', cpf: '707.430.104-34', email: 'edsongomesdonascimentoe@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Edson+Gomes&background=random' },
  { id: 'd18', name: 'ELIEL CARNEIRO GALDINO DA SILVA', cpf: '094.699.774-83', email: 'es472484@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Eliel+Carneiro&background=random' },
  { id: 'd19', name: 'FERNANDO JOSE ALVES DA SILVA', cpf: '638.176.164-49', email: 'fernandomocoto1@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Fernando+Jose&background=random' },
  { id: 'd20', name: 'FRANCISCO ISAAC COSTA DE LIMA', cpf: '068.186.124-07', email: 'franciscoisaaccosta31@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Francisco+Isaac&background=random' },
  { id: 'd21', name: 'FRANCISCO JULIO DOS SANTOS', cpf: '048.824.634-23', email: 'franciscojuliosantos765@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Francisco+Julio&background=random' },
  { id: 'd23', name: 'HENRIQUE EDUARDO DANTAS DE ARAUJO', cpf: '010.482.984-26', email: 'anapaulaehenrique.aps@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Henrique+Eduardo&background=random' },
  { id: 'd24', name: 'HUDSON HAENDEL DE AQUINO PEREIRA', cpf: '092.291.904-62', email: 'hudson.haendel@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Hudson+Haendel&background=random' },
  { id: 'd25', name: 'IKARO DE SOUZA COSTA', cpf: '113.888.834-65', email: 'ikarodesouza30@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Ikaro+De+Souza&background=random' },
  { id: 'd26', name: 'IRAN MICHELL DA SILVA', cpf: '031.032.114-06', email: 'iranmichell81@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Iran+Michell&background=random' },
  { id: 'd27', name: 'IZAIAS DIAS DE LIMA', cpf: '049.652.194-22', email: 'diasizaias253@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Izaias+Dias&background=random' },
  { id: 'd28', name: 'JOAIS ALVES DO NASCIMENTO', cpf: '474.246.484-20', email: 'joaisalvesdonascimento@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Joais+Alves&background=random' },
  { id: 'd29', name: 'JOSE ERIVALDO RODRIGUES DOS SANTOS', cpf: '052.287.234-47', email: 'silvapepe573@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Jose+Erivaldo&background=random' },
  { id: 'd30', name: 'JOSEILTON LOURENCO DE SOUZA', cpf: '013.030.644-48', email: 'Joseiltonlourenco11@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Joseilton+Lourenco&background=random' },
  { id: 'd32', name: 'LUCAS YURI LIMA DOS SANTOS', cpf: '016.864.784-29', email: 'lucasyuri_14@hotmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Lucas+Yuri&background=random' },
  { id: 'd33', name: 'LUCIANO DA SILVA DE FARIAS', cpf: '327.950.318-33', email: 'lu84farias@outlook.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Luciano+Da+Silva&background=random' },
  { id: 'd34', name: 'LUIZ ANTONIO FERNANDES DO NASCIMENTO', cpf: '812.676.654-91', email: 'luiz.unidade54@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Luiz+Antonio&background=random' },
  { id: 'd35', name: 'MARCOS AURELIO ALVES SOUTO JUNIOR', cpf: '045.061.984-25', email: 'marcosaurelioalves30@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Marcos+Aurelio&background=random' },
  { id: 'd36', name: 'MATHEUS MORENO DA SILVA', cpf: '122.455.564-37', email: 'theus.brap.1997@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Matheus+Moreno&background=random' },
  { id: 'd37', name: 'MAURILIO MARCOS DA SILVA', cpf: '010.428.204-57', email: 'mauriliomarcossilva81@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Maurilio+Marcos&background=random' },
  { id: 'd38', name: 'PAULO HENRIQUE DAMASCENO DE OLIVEIRA', cpf: '750.963.744-91', email: 'Oliveirapaulodamasceno@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Paulo+Henrique&background=random' },
  { id: 'd39', name: 'RENATO FIGUEIREDO DE MENDOCA', cpf: '028.651.254-83', email: 'mendona09@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Renato+Figueiredo&background=random' },
  { id: 'd40', name: 'ROBERTO TORRES PIO DA SILVA', cpf: '968.155.074-91', email: 'robertotorrespio2@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Roberto+Torres&background=random' },
  { id: 'd41', name: 'SEVERINO NASCIMENTO SANTOS', cpf: '096.249.654-55', email: 'severino.santos@guincholog.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Severino+Nascimento&background=random' },
  { id: 'd42', name: 'THIAGO JOSE DE LIMA', cpf: '096.931.414-07', email: 'limathiago2600@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Thiago+Jose&background=random' },
  { id: 'd43', name: 'TIAGO KLEBER DA CRUZ SILVA', cpf: '058.348.524-32', email: 'bbezerra173@gmail.com', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Tiago+Kleber&background=random' },
  { id: 'd44', name: 'MATHEUS HENRIQUE DE ARAUJO RODRIGUES', cpf: '096.677.434-54', email: '', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Matheus+Henrique&background=random' },
  { id: 'd45', name: 'RAFAEL SANTOS DE MELO', cpf: '038.035.054-88', email: '', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Rafael+Santos&background=random' },
  { id: 'd46', name: 'DEUSDEDITE APARECIDO DE MORAES', cpf: '166.040.708-75', email: '166.040.708-75', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Deusdedite+Aparecido&background=random' },
  { id: 'd47', name: 'CACIO LUAN DA SILVA VILELA', cpf: '701.684.544-32', email: '701.684.544-32', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Cacio+Luan&background=random' },
  { id: 'd48', name: 'FABIO CARLOS DA SILVA DOMINGOS', cpf: '119.776.384-81', email: '119.776.384-81', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Fabio+Carlos&background=random' },
  { id: 'd49', name: 'CARLOS JOSE DE SENA', cpf: '671.702.004-06', email: '671.702.004-06', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Carlos+Jose&background=random' },
  { id: 'd50', name: 'WILLIAM THOMAS SOUSA DE FREITAS', cpf: '095.127.194-60', email: '095.127.194-60', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=William+Thomas&background=random' },
  { id: 'd51', name: 'WILSON GOMES ZUMBA', cpf: '289.277.704-63', email: '289.277.704-63', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Wilson+Gomes&background=random' },
  { id: 'd52', name: 'LUIZ AMARO DE BRITO ROCHA', cpf: '114.528.164-84', email: '114.528.164-84', role: UserRole.DRIVER, avatarUrl: 'https://ui-avatars.com/api/?name=Luiz+Amaro&background=random' },
];

export const POSTOS = [
  'POSTO BASE ALEX REBOQUE',
  'POSTO CONFIANÇA - SGA',
  'POSTO COOPACABANA',
  'POSTO DIVERSOS-OUTROS',
  'POSTO DM ANGICOS',
  'POSTO DM ASSU',
  'POSTO DM SOUZA',
  'POSTO NEOPOLIS',
  'POSTO PINHEIRO PQ IND',
  'POSTO PINHEIRO SATÉLITE',
  'POSTO SPX XAVANTES',
  'POSTO TANQUE CHEIO',
  'POSTO XAVANTES'
];

export const TIPOS_COMBUSTIVEL = [
  'ADITIVO - ARLA 32',
  'DIESEL ADITIVADO',
  'DIESEL S10',
  'DIESEL S10 ADITIVADO',
  'DIESEL S50',
  'DIESEL S500',
  'ETANOL',
  'ETANOL ADITIVADA',
  'GASOLINA',
  'GASOLINA ADITIVADA',
  'GNV'
];

export const MOCK_HISTORY_LOGS = [];
export const MOCK_MECHANICS: User[] = [
  { id: 'mec-1', name: 'SILVANO DA SILVA NETO', email: 'silvano@guincholog.com', cpf: '068.057.264-33', role: UserRole.MECHANIC, avatarUrl: 'https://ui-avatars.com/api/?name=Silvano+Silva&background=0D8ABC&color=fff' }
];

export const TIPOS_MANUTENCAO = [
  'PREVENTIVA',
  'CORRETIVA',
  'TROCA DE ÓLEO',
  'FILTROS',
  'FREIOS',
  'PNEUS',
  'SUSPENSÃO',
  'PARTE ELÉTRICA',
  'MOTOR',
  'OUTROS'
];

export const getLocalDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().split('T')[0];
};

export const getLocalDateFromDate = (dateObj: Date) => {
  const date = new Date(dateObj.getTime());
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().split('T')[0];
};

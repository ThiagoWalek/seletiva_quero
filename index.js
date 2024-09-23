import express from "express";
import path from "path";
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const app = express();
const __dirname = path.resolve(path.dirname(''));
let offers = [];

// Middleware
app.use(express.static(path.join(__dirname, '')));
app.use(express.json());

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint para listar ofertas
app.get("/ofertas", (req, res) => {
    const { nivel, tipo, minPrice, maxPrice, page = 1, limit = 10, search } = req.query;

    let filteredOffers = offers;

    // Filtragem
    if (nivel) {
        filteredOffers = filteredOffers.filter(offer => offer.level === nivel);
    }
    if (tipo) {
        filteredOffers = filteredOffers.filter(offer => offer.kind === tipo);
    }
    if (minPrice) {
        filteredOffers = filteredOffers.filter(offer => offer.offeredPrice >= minPrice);
    }
    if (maxPrice) {
        filteredOffers = filteredOffers.filter(offer => offer.offeredPrice <= maxPrice);
    }
    if (search) {
        filteredOffers = filteredOffers.filter(offer =>
            offer.courseName.toLowerCase().includes(search.toLowerCase())
        );
    }

    // Ordenação
    const sortBy = req.query.sortBy || 'courseName';
    filteredOffers.sort((a, b) => {
        if (a[sortBy] < b[sortBy]) return -1;
        if (a[sortBy] > b[sortBy]) return 1;
        return 0;
    });

    // Paginação
    const total = filteredOffers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOffers = filteredOffers.slice(startIndex, endIndex);

    // Formatação dos dados
    const formattedOffers = paginatedOffers.map(offer => ({
        ...offer,
        offeredPrice: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.offeredPrice),
        fullPrice: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.fullPrice),
        desconto: `${((offer.fullPrice - offer.offeredPrice) / offer.fullPrice * 100).toFixed(0)}%📉`,
        tipo: offer.kind === 'presencial' ? 'Presencial🏫' : 'EaD🏠',
        nivel: offer.level === 'bacharel' ? 'Graduação (bacharelado)🎓' :
               offer.level === 'tecnologo' ? 'Graduação (tecnólogo)🎓' :
               'Graduação (licenciatura)🎓'
    }));

    res.status(200).json({
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        offers: formattedOffers
    });
});

// Endpoint para adicionar ofertas
app.post("/ofertas", async (req, res) => {
    const { courseName, nivel, tipo, fullPrice, offerPrice } = req.body;

    const newOffer = await prisma.offer.create({
        data: {
            courseName,
            level: nivel,
            kind: tipo,
            fullPrice,
            offeredPrice: offerPrice
        }
    });

    offers.push(newOffer); // Adiciona a nova oferta à lista em memória
    res.status(201).json(newOffer);
});

// Rota para relatorio
app.get("/relatorio", (req, res) => {
    res.sendFile(path.join(__dirname, 'relatorio.html'));
});

// Endpoint para carregar ofertas do data.json e cadastrar no banco de dados
// Endpoint para carregar ofertas do data.json e cadastrar no banco de dados
app.post("/carregar-ofertas", async (req, res) => {
    try {
        const data = req.body; // O JSON deve vir diretamente do corpo da requisição

        // Lê o arquivo apenas quando o botão de enviar for clicado
        const fileData = await fs.promises.readFile('data.json', 'utf8');
        const fileOffers = JSON.parse(fileData).offers || [];

        // Adiciona as ofertas lidas do arquivo à variável offers
        offers.push(...fileOffers);

        // Cadastra cada oferta no banco de dados
        for (const offer of fileOffers) {
            await prisma.offer.create({
                data: {
                    courseName: offer.courseName,
                    rating: offer.rating,
                    fullPrice: offer.fullPrice,
                    offeredPrice: offer.offeredPrice,
                    kind: offer.kind,
                    level: offer.level,
                    iesLogo: offer.iesLogo,
                    iesName: offer.iesName,
                },
            });
        }

        res.status(201).send("Ofertas cadastradas com sucesso!");
    } catch (error) {
        console.error("Erro ao carregar ofertas:", error);
        res.status(500).send("Erro ao carregar ofertas.");
    }
});

// Inicie o servidor
app.listen(process.env.PORT || 3000, () => {
    console.log("Rodando Servidor!");
});

import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import {
    Box,
    Grid,
    GridItem,
    Heading,
    Text,
    Flex,
    Badge,
    Button,
    Icon,
    Card,
    CardHeader,
    CardBody,
    Select,
    Input,
    InputGroup,
    InputLeftElement,
    useColorModeValue,
    SimpleGrid,
    Tag,
    TagLeftIcon,
    TagLabel,
    IconButton,
    useToast,
    AlertDialog,
    AlertDialogBody,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogContent,
    AlertDialogOverlay,
    useDisclosure,
    Tooltip,
    Switch,
    FormControl,
    FormLabel,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    Divider,
    Stack, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, VStack, Image, ModalFooter
} from '@chakra-ui/react';
import {
    FaRoute,
    FaSearch,
    FaFilter,
    FaEye,
    FaEdit,
    FaTrash,
    FaClock,
    FaMapMarkerAlt,
    FaArrowUp,
    FaArrowDown,
    FaStar,
    FaRegStar,
    FaCar,
    FaRoad,
    FaTachometerAlt,
    FaMapMarkedAlt,
    FaCalendarAlt,
    FaEllipsisV,
    FaPlusCircle,
    FaHistory,
    FaExchangeAlt, FaQrcode
} from 'react-icons/fa';
import NextLink from 'next/link';
import axios from 'axios';
import { useRouter } from 'next/router';
import {FaRoadSpikes} from "react-icons/fa6";
import api from "@/services/api";
import {FiDownload} from "react-icons/fi";

interface RouteCoordinates {
    type: string;
    coordinates: number[];
    crs: any;
}

interface Route {
    id: string;
    userId: string;
    name: string;
    originName: string;
    destinationName: string;
    originCoordinates: RouteCoordinates;
    destinationCoordinates: RouteCoordinates;
    waypoints: any[];
    routeData: any;
    geometry: any;
    distance: number;
    duration: number;
    avoidTolls: boolean;
    routeType: string;
    isFavorite: boolean;
    lastUsed: string;
    createdAt: string;
    updatedAt: string;
}

interface RoutesPageProps {
    routes: Route[];
    userData: {
        username: string;
        id: string;
    };
}

const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}min`;
    } else {
        return `${minutes}min`;
    }
};

const formatDistance = (meters: number) => {
    if (meters < 1000) {
        return `${meters}m`;
    } else {
        return `${(meters / 1000).toFixed(1)}km`;
    }
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const getRouteTypeIcon = (routeType: string) => {
    switch (routeType) {
        case 'fastest':
            return FaTachometerAlt;
        case 'shortest':
            return FaRoad;
        case 'eco':
            return FaRoute;
        default:
            return FaCar;
    }
};

const getRouteTypeLabel = (routeType: string) => {
    switch (routeType) {
        case 'fastest':
            return 'Le plus rapide';
        case 'shortest':
            return 'Le plus court';
        case 'eco':
            return 'Économique';
        default:
            return 'Standard';
    }
};

const RoutesPage = ({ routes: initialRoutes, userData }: RoutesPageProps) => {
    const [routes, setRoutes] = useState<Route[]>(initialRoutes);
    const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
    const [filterRouteType, setFilterRouteType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortBy, setSortBy] = useState<string>('lastUsed');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [qrCodeData, setQRCodeData] = useState<string | null>(null);
    const [currentRoute, setCurrentRoute] = useState<Route | null>(null);

    const router = useRouter();
    const toast = useToast();
    const cardBg = useColorModeValue('white', 'gray.800');
    const { isOpen, onOpen, onClose } = useDisclosure();
    const cancelRef = React.useRef<HTMLButtonElement>(null);
    const [routeToDelete, setRouteToDelete] = useState<string | null>(null);
    const { isOpen: isQRCodeOpen, onOpen: onQRCodeOpen, onClose: onQRCodeClose } = useDisclosure();

    const filteredRoutes = routes.filter(route => {
        if (filterFavorite && !route.isFavorite) return false;

        if (filterRouteType !== 'all' && route.routeType !== filterRouteType) return false;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                route.name.toLowerCase().includes(query) ||
                route.originName.toLowerCase().includes(query) ||
                route.destinationName.toLowerCase().includes(query)
            );
        }

        return true;
    });

    const sortedRoutes = [...filteredRoutes].sort((a, b) => {
        if (sortBy === 'lastUsed') {
            const dateA = new Date(a.lastUsed).getTime();
            const dateB = new Date(b.lastUsed).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        } else if (sortBy === 'name') {
            return sortOrder === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
        } else if (sortBy === 'distance') {
            return sortOrder === 'asc'
                ? a.distance - b.distance
                : b.distance - a.distance;
        } else if (sortBy === 'duration') {
            return sortOrder === 'asc'
                ? a.duration - b.duration
                : b.duration - a.duration;
        }
        return 0;
    });

    const handleDeleteClick = (id: string) => {
        setRouteToDelete(id);
        onOpen();
    };

    const confirmDelete = async () => {
        if (!routeToDelete) return;

        try {
            await api.routes.deleteRoute(routeToDelete);

            setRoutes(routes.filter(route => route.id !== routeToDelete));

            toast({
                title: "Itinéraire supprimé",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible de supprimer l'itinéraire",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            onClose();
            setRouteToDelete(null);
        }
    };

    const handleDownloadQRCode = async (route: Route) => {
        setCurrentRoute(route);
        try {
            const response = await api.routes.generateQRCode(route.id);

            if (!response.data) {
                toast({
                    title: "Erreur",
                    description: "Aucune donnée QR Code reçue.",
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
                return;
            }

            setQRCodeData(response.data.qrCode);

            onQRCodeOpen();

            toast({
                title: "QR Code généré",
                description: `Le QR Code pour l'itinéraire ${route.name} a été généré avec succès.`,
                status: "success",
                duration: 5000,
                isClosable: true,
            });
        } catch (error) {
            console.error('Erreur lors de la génération du QR Code:', error);
            toast({
                title: "Erreur",
                description: "Une erreur est survenue lors de la génération du QR Code.",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const downloadQRCode = () => {
        if (!qrCodeData || !currentRoute) return;

        const link = document.createElement('a');
        link.href = qrCodeData;
        link.download = `qrcode-${currentRoute.name.replace(/\s+/g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: "QR Code téléchargé",
            description: "Le QR Code a été téléchargé avec succès.",
            status: "success",
            duration: 3000,
            isClosable: true,
        });
    };

    const toggleFavorite = async (route: Route) => {
        try {
            const updatedIsFavorite = !route.isFavorite;

            await api.routes.updateRoute(route.id, { isFavorite: updatedIsFavorite });

            setRoutes(routes.map(r =>
                r.id === route.id ? { ...r, isFavorite: updatedIsFavorite } : r
            ));

            toast({
                title: updatedIsFavorite ? "Ajouté aux favoris" : "Retiré des favoris",
                status: "success",
                duration: 2000,
                isClosable: true,
            });
        } catch (error) {
            toast({
                title: "Erreur",
                description: "Impossible de mettre à jour les favoris",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const viewOnMap = (route: Route) => {
        router.push(`/map?route=${route.id}`);
    };

    return (
        <Box maxW="7xl" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }}>
            <Grid templateColumns={{ base: "1fr", md: "1fr" }} gap={6}>
                {/* En-tête */}
                <GridItem colSpan={1}>
                    <Card bg={cardBg} boxShadow="md" mb={6}>
                        <CardBody>
                            <Flex direction={{ base: 'column', md: 'row' }} align="center" justify="space-between">
                                <Box>
                                    <Heading size="lg" mb={2}>Mes itinéraires</Heading>
                                    <Text color="gray.500">Gérez vos trajets sauvegardés</Text>
                                </Box>
                                <Button
                                    as={NextLink}
                                    href="/map"
                                    colorScheme="blue"
                                    size="lg"
                                    leftIcon={<FaPlusCircle />}
                                    mt={{ base: 4, md: 0 }}
                                >
                                    Créer un itinéraire
                                </Button>
                            </Flex>
                        </CardBody>
                    </Card>
                </GridItem>

                {/* Filtres et recherche */}
                <GridItem colSpan={1}>
                    <Card bg={cardBg} boxShadow="md" mb={6}>
                        <CardBody>
                            <Flex direction={{ base: 'column', sm: 'row' }} gap={4} mb={4}>
                                <InputGroup>
                                    <InputLeftElement pointerEvents='none'>
                                        <Icon as={FaSearch} color='gray.300' />
                                    </InputLeftElement>
                                    <Input
                                        placeholder='Rechercher par nom ou adresse'
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </InputGroup>

                                <Select
                                    icon={<FaFilter />}
                                    placeholder="Type d'itinéraire"
                                    value={filterRouteType}
                                    onChange={(e) => setFilterRouteType(e.target.value)}
                                    maxW={{ sm: '200px' }}
                                >
                                    <option value="all">Tous les types</option>
                                    <option value="fastest">Plus rapide</option>
                                    <option value="shortest">Plus court</option>
                                    <option value="eco">Économique</option>
                                </Select>

                                <FormControl display='flex' alignItems='center' justifyContent='center' width='auto'>
                                    <FormLabel htmlFor='fav-filter' mb='0' whiteSpace="nowrap">
                                        <Icon as={FaStar} color="yellow.400" mr={1} />
                                        Favoris
                                    </FormLabel>
                                    <Switch
                                        id='fav-filter'
                                        colorScheme="yellow"
                                        isChecked={filterFavorite}
                                        onChange={() => setFilterFavorite(!filterFavorite)}
                                    />
                                </FormControl>
                            </Flex>

                            <Flex justifyContent="flex-end" alignItems="center" gap={2}>
                                <Text fontSize="sm">Trier par:</Text>
                                <Select
                                    size="sm"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    width="auto"
                                >
                                    <option value="lastUsed">Dernier utilisé</option>
                                    <option value="name">Nom</option>
                                    <option value="distance">Distance</option>
                                    <option value="duration">Durée</option>
                                </Select>

                                <IconButton
                                    aria-label="Ordre de tri"
                                    icon={sortOrder === 'asc' ? <FaArrowUp /> : <FaArrowDown />}
                                    size="sm"
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                />
                            </Flex>
                        </CardBody>
                    </Card>
                </GridItem>

                {/* Liste des itinéraires */}
                <GridItem colSpan={1}>
                    <Card bg={cardBg} boxShadow="md">
                        <CardHeader>
                            <Heading size="md">
                                {sortedRoutes.length} itinéraire{sortedRoutes.length !== 1 ? 's' : ''} trouvé{sortedRoutes.length !== 1 ? 's' : ''}
                            </Heading>
                        </CardHeader>
                        <CardBody>
                            {sortedRoutes.length > 0 ? (
                                <SimpleGrid columns={1} spacing={4}>
                                    {sortedRoutes.map((route) => (
                                        <Card key={route.id} variant="outline" position="relative">
                                            {route.isFavorite && (
                                                <Icon
                                                    as={FaStar}
                                                    position="absolute"
                                                    top={2}
                                                    right={2}
                                                    color="yellow.400"
                                                    boxSize={5}
                                                />
                                            )}
                                            <CardBody>
                                                <Box
                                                    cursor="pointer"
                                                    onClick={() => viewOnMap(route)}
                                                    _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                                                    p={2}
                                                    borderRadius="md"
                                                >
                                                    <Flex
                                                        direction={{ base: 'column', md: 'row' }}
                                                        justify="space-between"
                                                        align={{ md: 'center' }}
                                                    >
                                                        <Box flex="1">
                                                            <Heading size="md" mb={2}>{route.name}</Heading>

                                                            <Flex
                                                                direction={{ base: 'column', sm: 'row' }}
                                                                gap={{ base: 1, sm: 6 }}
                                                                mb={3}
                                                            >
                                                                <Flex align="center" color="gray.600">
                                                                    <Icon as={FaMapMarkerAlt} color="blue.500" mr={2} />
                                                                    <Text fontWeight="medium">De: {route.originName}</Text>
                                                                </Flex>

                                                                <Flex align="center" color="gray.600">
                                                                    <Icon as={FaMapMarkerAlt} color="red.500" mr={2} />
                                                                    <Text fontWeight="medium">À: {route.destinationName}</Text>
                                                                </Flex>
                                                            </Flex>

                                                            <Flex wrap="wrap" gap={4} mt={2}>
                                                                <Flex align="center">
                                                                    <Icon as={FaRoad} mr={1} color="gray.500" />
                                                                    <Text>{formatDistance(route.distance)}</Text>
                                                                </Flex>

                                                                <Flex align="center">
                                                                    <Icon as={FaClock} mr={1} color="gray.500" />
                                                                    <Text>{formatDuration(route.duration)}</Text>
                                                                </Flex>

                                                                <Flex align="center">
                                                                    <Icon as={getRouteTypeIcon(route.routeType)} mr={1} color="gray.500" />
                                                                    <Text>{getRouteTypeLabel(route.routeType)}</Text>
                                                                </Flex>

                                                                {route.avoidTolls && (
                                                                    <Flex align="center">
                                                                        <Icon as={FaRoadSpikes} mr={1} color="gray.500" />
                                                                        <Text>Sans péage</Text>
                                                                    </Flex>
                                                                )}
                                                            </Flex>

                                                            <Text fontSize="xs" color="gray.500" mt={2}>
                                                                <Icon as={FaCalendarAlt} mr={1} />
                                                                Dernière utilisation: {formatDate(route.lastUsed)}
                                                            </Text>
                                                        </Box>
                                                    </Flex>
                                                </Box>

                                                <Divider my={3} />

                                                <Flex justify="space-between" align="center">
                                                    <Button
                                                        leftIcon={<FaMapMarkedAlt />}
                                                        colorScheme="blue"
                                                        variant="solid"
                                                        size="sm"
                                                        onClick={() => viewOnMap(route)}
                                                    >
                                                        Voir sur la carte
                                                    </Button>

                                                    <Stack direction="row" spacing={2}>
                                                        <IconButton
                                                            aria-label={route.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                                                            icon={route.isFavorite ? <FaRegStar /> : <FaStar />}
                                                            onClick={() => toggleFavorite(route)}
                                                            colorScheme="yellow"
                                                            variant="ghost"
                                                            size="sm"
                                                        />

                                                        <IconButton
                                                            aria-label={"Générer le QRCode"}
                                                            icon={<FaQrcode />}
                                                            onClick={() => handleDownloadQRCode(route)}
                                                            colorScheme="white"
                                                            variant="ghost"
                                                            size="sm"
                                                        />

                                                        <IconButton
                                                            aria-label={"Supprimer"}
                                                            icon={<FaTrash />}
                                                            onClick={() => handleDeleteClick(route.id)}
                                                            colorScheme="red"
                                                            variant="ghost"
                                                            size="sm"
                                                        />
                                                    </Stack>
                                                </Flex>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </SimpleGrid>
                            ) : (
                                <Box textAlign="center" py={8}>
                                    <Icon as={FaRoute} boxSize={10} color="gray.400" mb={4} />
                                    <Text mb={4} color="gray.500">Aucun itinéraire trouvé</Text>
                                    <Button
                                        as={NextLink}
                                        href="/map"
                                        colorScheme="blue"
                                        leftIcon={<FaMapMarkedAlt />}
                                    >
                                        Créer un itinéraire
                                    </Button>
                                </Box>
                            )}
                        </CardBody>
                    </Card>
                </GridItem>
            </Grid>

            {/* Modal QR Code */}
            <Modal isOpen={isQRCodeOpen} onClose={onQRCodeClose} isCentered size="md">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>QR Code de l'itinéraire</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={6}>
                        {qrCodeData && currentRoute ? (
                            <VStack spacing={4} align="center">
                                <Text fontWeight="medium">
                                    {currentRoute.name}
                                </Text>

                                <Box
                                    p={4}
                                    borderWidth="1px"
                                    borderRadius="md"
                                    bg={useColorModeValue('white', 'gray.700')}
                                    boxShadow="sm"
                                    width="100%"
                                    display="flex"
                                    justifyContent="center"
                                >
                                    <Image
                                        src={qrCodeData}
                                        alt={`QR Code pour l'itinéraire ${currentRoute.name}`}
                                        maxW="250px"
                                        maxH="250px"
                                    />
                                </Box>

                                <Text fontSize="sm" color="gray.500" textAlign="center">
                                    Scannez ce QR code pour accéder à l'itinéraire depuis n'importe quel appareil.
                                </Text>

                                <Flex gap={4} width="100%" mt={2}>
                                    <Button
                                        leftIcon={<FiDownload />}
                                        colorScheme="blue"
                                        onClick={downloadQRCode}
                                        flex="1"
                                    >
                                        Télécharger
                                    </Button>

                                </Flex>
                            </VStack>
                        ) : (
                            <Text>Chargement du QR code...</Text>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" onClick={onQRCodeClose}>
                            Fermer
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Dialog de confirmation de suppression */}
            <AlertDialog
                isOpen={isOpen}
                leastDestructiveRef={cancelRef}
                onClose={onClose}
            >
                <AlertDialogOverlay>
                    <AlertDialogContent>
                        <AlertDialogHeader fontSize="lg" fontWeight="bold">
                            Supprimer l'itinéraire
                        </AlertDialogHeader>

                        <AlertDialogBody>
                            Êtes-vous sûr de vouloir supprimer cet itinéraire ? Cette action ne peut pas être annulée.
                        </AlertDialogBody>

                        <AlertDialogFooter>
                            <Button ref={cancelRef} onClick={onClose}>
                                Annuler
                            </Button>
                            <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                                Supprimer
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>
        </Box>
    );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { req } = context;
    const token = req.cookies.token;

    if (!token) {
        return {
            redirect: {
                destination: '/login',
                permanent: false,
            },
        };
    }

    try {
        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        const userResponse = await axios.get(`${process.env.API_URL}/api/auth/me`, config);
        const userId = userResponse.data.data.user.id;

        const routesResponse = await axios.get(
            `${process.env.API_URL}/api/navigation/routes/user`,
            {
                ...config,
                params: { userId }
            }
        );

        return {
            props: {
                routes: routesResponse.data.data.routes || [],
                userData: userResponse.data.data.user
            },
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);

        if (axios.isAxiosError(error) && error.response?.status === 401) {
            return {
                redirect: {
                    destination: '/login',
                    permanent: false,
                },
            };
        }

        return {
            props: {
                routes: [],
                userData: { username: "Utilisateur", id: "" }
            },
        };
    }
};

export default RoutesPage;
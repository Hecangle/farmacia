<?php
/**
 * sync_db.php - Sincroniza la base de datos SQLite en disco cuando se ejecuta en servidor web
 */
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = file_get_contents('php://input');
    if ($data !== false && strlen($data) > 0) {
        $dbPath = __DIR__ . '/farmacia.db';
        file_put_contents($dbPath, $data);
        echo json_encode(['exito' => true, 'tamano' => strlen($data)]);
        exit;
    }
}

echo json_encode(['exito' => false, 'mensaje' => 'Sin datos']);

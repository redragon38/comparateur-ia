<?php
header('Content-Type: application/json; charset=utf-8');

$filename = 'info.json';
if (!file_exists($filename)) {
  echo json_encode(["error" => "Fichier JSON introuvable."]);
  exit;
}

$data = json_decode(file_get_contents($filename), true);
if (!isset($data['providers'])) {
  $data['providers'] = [];
}

$action = $_GET['action'] ?? '';

switch ($action) {
  case 'save':
    $input = json_decode(file_get_contents('php://input'), true);
    $data['providers'][] = $input;
    file_put_contents($filename, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "✅ Fournisseur ajouté avec succès.";
    break;

  case 'edit':
    $index = intval($_GET['index']);
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($data['providers'][$index])) {
      $data['providers'][$index] = $input;
      file_put_contents($filename, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
      echo "✏️ Fournisseur modifié avec succès.";
    } else {
      echo "❌ Index invalide.";
    }
    break;

  case 'delete':
    $index = intval($_GET['index']);
    if (isset($data['providers'][$index])) {
      array_splice($data['providers'], $index, 1);
      file_put_contents($filename, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
      echo "🗑️ Fournisseur supprimé.";
    } else {
      echo "❌ Index invalide.";
    }
    break;

  default:
    echo json_encode(["error" => "Action non reconnue."]);
}
?>

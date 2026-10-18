# Etapa 2. Promedios de lluvia sobre el poligono, ponderados por cobertura.
extraer_lluvia_octubre <- function(d) {
  archivos <- vapply(2022:2025, function(anio) file.path(
    d$carpeta_datos,
    "Reto_AgroCebada_CHIRPS_Precipitacion_2022_2025/Precipitacion_mensual",
    anio, sprintf("PREC_%d_10.tif", anio)), character(1))
  stopifnot(all(file.exists(archivos)))
  mapas <- terra::rast(archivos)
  poligonos <- sf::st_transform(d$poligonos, terra::crs(mapas))
  lluvia <- as.matrix(exactextractr::exact_extract(
    mapas, poligonos, "mean", progress = FALSE))
  colnames(lluvia) <- paste0("octubre_", 2022:2025)
  stopifnot(nrow(lluvia) == 197L, all(is.finite(lluvia)), all(lluvia >= 0))
  h <- rowMeans(lluvia[, 1:3, drop = FALSE])
  p <- lluvia[, 4]
  stopifnot(all(h > 0))
  d$lluvia_original <- lluvia
  d$octubre <- cbind(P = p, H = h, DELTA = p - h, PCT = 100 * (p - h) / h)
  d$fuentes <- c(d$fuentes, archivos)
  d
}

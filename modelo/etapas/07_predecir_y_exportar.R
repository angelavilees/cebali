# Etapa 7. Aplicar la receta congelada y guardar resultados trazables.
preparar_consultas <- function(d, indices = d$consultas) {
  data.frame(ID_POLIGONO = d$ids[indices], municipio = d$meta$municipio[indices],
    lon = d$meta$lon[indices], lat = d$meta$lat[indices],
    P = d$octubre[indices, "P"], H = d$octubre[indices, "H"], K = d$k[indices])
}

predecir_modelo <- function(modelo, datos, registro = NULL) {
  campos <- c("ID_POLIGONO", "municipio", "lon", "lat", "P", "H", "K")
  stopifnot(all(campos %in% names(datos)), nrow(datos) > 0,
    !anyNA(datos$ID_POLIGONO), !anyDuplicated(datos$ID_POLIGONO),
    !length(intersect(datos$ID_POLIGONO, modelo$known$ID_POLIGONO)),
    !anyNA(datos$municipio), all(nzchar(as.character(datos$municipio))),
    !any(c("RENDIMIENTO_T_HA", "y", "truth", "real") %in% names(datos)),
    all(is.finite(as.matrix(datos[, c("lon", "lat", "P", "H")]))),
    all(datos$H > 0), all(datos$P >= 0),
    all(is.finite(datos$K) | is.na(datos$K)))
  if (!is.null(registro)) {
    ix <- match(datos$ID_POLIGONO, registro$ID_POLIGONO)
    stopifnot(!anyNA(ix),
      all(as.character(datos$municipio) == as.character(registro$municipio[ix])),
      max(abs(datos$lon - registro$lon[ix]), abs(datos$lat - registro$lat[ix])) <= 1e-8)
  }
  x <- cbind(P = datos$P, H = datos$H, DELTA = datos$P - datos$H,
             PCT = 100 * (datos$P - datos$H) / datos$H)
  j <- modelo$J
  z <- (x[, j$variable] - j$mean) / j$sd
  g <- as.character(datos$municipio)
  grupo <- unname(modelo$group_map[g])
  stopifnot(!anyNA(grupo))
  my <- as.numeric(j$group_mean_y[grupo])
  mz <- as.numeric(j$group_mean_z[grupo])
  nuevas <- !is.finite(my)
  my[nuevas] <- modelo$global_y
  mz[nuevas] <- modelo$global_z
  lluvia <- my + j$beta * (z - mz)
  municipal <- as.numeric(modelo$municipal_means[g])
  municipal[!is.finite(municipal)] <- modelo$global_y
  idw <- vapply(seq_len(nrow(datos)), function(i) {
    distancias <- distancia_km(datos$lon[i], datos$lat[i],
                               modelo$known$lon, modelo$known$lat)
    nn <- head(order(distancias, modelo$known$ID_POLIGONO), 20)
    weighted.mean(modelo$known$y[nn], 1 / pmax(distancias[nn] * 1000, 1)^2)
  }, numeric(1))
  correccion <- rep(0, nrow(datos))
  validas <- is.finite(datos$K)
  k <- modelo$correction
  if (is.finite(k$sd) && k$sd > 1e-12) {
    correccion[validas] <- k$beta * (datos$K[validas] - k$median) / k$sd
  }
  mezcla <- .5 * municipal + .5 * idw + correccion
  prediccion <- .5 * lluvia + .5 * mezcla
  stopifnot(all(is.finite(prediccion)))
  list(predicciones = data.frame(ID_POLIGONO = as.character(datos$ID_POLIGONO),
    RENDIMIENTO_T_HA = as.numeric(prediccion)),
    componentes = data.frame(ID_POLIGONO = datos$ID_POLIGONO, grupo = grupo, J = lluvia,
      MUN = municipal, IDW20 = idw, K_correction = correccion,
      MIX_CORR = mezcla, K_available = validas))
}

exportar_resultados <- function(d, ajuste, resultado, salida) {
  saveRDS(ajuste$modelo, file.path(salida, "modelo_oct_g5.rds"))
  saveRDS(preparar_consultas(d), file.path(salida, "entradas_59.rds"))
  saveRDS(d, file.path(salida, "datos_preparados.rds"))
  tablas <- list(predicciones_59 = resultado$predicciones,
    componentes_59 = resultado$componentes, metadata_197 = d$meta,
    lluvia_197 = data.frame(ID_POLIGONO = d$ids, d$lluvia_original, d$octubre),
    planet_197 = d$planet, curvas_planet = d$curvas,
    residuos_internos_138 = ajuste$oof)
  for (nombre in names(tablas)) write.csv(tablas[[nombre]],
    file.path(salida, paste0(nombre, ".csv")), row.names = FALSE)
  invisible(tablas)
}

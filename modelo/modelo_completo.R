# Cebali: OCT_MIX 1.4.0. Flujo completo desde archivos oficiales.
# Este archivo contiene las nueve etapas; no carga scripts historicos.


# ======================================================================
# 01_leer_y_unir_datos.R
# ======================================================================
# Etapa 1. Leer los archivos oficiales y unirlos por identificador.
comprobar_dependencias <- function() {
  paquetes <- c("sf", "terra", "exactextractr", "readr", "tidyselect", "rsample", "jsonlite")
  faltan <- paquetes[!vapply(paquetes, requireNamespace, logical(1), quietly = TRUE)]
  if (length(faltan)) stop("Instala primero: ", paste(faltan, collapse = ", "))
}

leer_y_unir_datos <- function(carpeta_datos, carpeta_paquete) {
  comprobar_dependencias()
  archivo <- function(nombre) file.path(carpeta_datos, nombre)
  objetivo <- archivo("ID_area_rendimiento_70_30_Reto_AgroCebada.csv")
  basico <- archivo("BASICO_AgroCebada2026.csv")
  shp <- archivo("Parcelas_Reto_AGC_CONJUNTO_70_30/Parcelas_Reto_AGC_CONJUNTO.shp")
  requeridos <- c(objetivo, basico,
                 paste0(sub("\\.shp$", "", shp), c(".shp", ".shx", ".dbf", ".prj")))
  stopifnot(all(file.exists(requeridos)))
  t <- as.data.frame(readr::read_csv(objetivo, show_col_types = FALSE,
                                    name_repair = "minimal"))
  t <- t[, c("ID_POLIGONO", "AREA_HA", "RENDIMIENTO_T_HA", "CONJUNTO")]
  orden <- readr::read_csv(basico, col_select = "ID_POLIGONO", show_col_types = FALSE)
  readr::stop_for_problems(orden)
  ids <- unique(orden$ID_POLIGONO)
  contrato <- read.csv(file.path(carpeta_paquete, "contratos/orden_parcelas.csv"))
  # BASICO aporta exclusivamente el orden reproducible; no sus mediciones.
  stopifnot(identical(ids, as.character(contrato$ID_POLIGONO)), length(ids) == 197L,
            !anyNA(ids), !anyDuplicated(t$ID_POLIGONO),
            setequal(ids, t$ID_POLIGONO))
  t <- t[match(ids, t$ID_POLIGONO), ]
  rownames(t) <- NULL
  tr <- which(t$CONJUNTO == "ENTRENAMIENTO")
  u <- which(t$CONJUNTO == "PREDICCION")
  stopifnot(length(tr) == 138L, length(u) == 59L,
            all(is.finite(t$RENDIMIENTO_T_HA[tr])),
            all(is.na(t$RENDIMIENTO_T_HA[u])), all(is.finite(t$AREA_HA)),
            all(t$AREA_HA > 0))
  p <- sf::st_read(shp, quiet = TRUE)
  stopifnot(!anyDuplicated(p$ID_POLIGON), setequal(ids, p$ID_POLIGON),
            !is.na(sf::st_crs(p)))
  p <- p[match(ids, p$ID_POLIGON), ]
  stopifnot(all(as.character(p$CONJUNTO) == t$CONJUNTO))
  pmet <- sf::st_transform(p, 6372)
  stopifnot(all(sf::st_is_valid(pmet)), !any(sf::st_is_empty(pmet)))
  xy <- suppressWarnings(sf::st_coordinates(
    sf::st_transform(sf::st_centroid(pmet), 4326)))
  meta <- data.frame(ID_POLIGONO = ids, estado = as.character(p$Estado),
                     municipio = as.character(p$Municipio),
                     lon = xy[, 1], lat = xy[, 2])
  stopifnot(!anyNA(meta), all(nzchar(meta$municipio)),
            all(is.finite(meta$lon)), all(is.finite(meta$lat)))
  list(ids = ids, tabla = t, meta = meta, poligonos = p,
       y = t$RENDIMIENTO_T_HA, entrenamiento = tr, consultas = u,
       carpeta_datos = carpeta_datos, fuentes = requeridos)
}


# ======================================================================
# 02_extraer_lluvia_octubre.R
# ======================================================================
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


# ======================================================================
# 03_preparar_trayectoria_planet.R
# ======================================================================
# Etapa 3. Filtrar Planet, suavizar NDVI e integrar el verdor sobre la base.
preparar_trayectoria_planet <- function(d) {
  pro <- file.path(d$carpeta_datos, "PRO_AgroCebada.csv")
  campos <- c("ID_POLIGONO", "fecha_captura", "sensor",
              "ndvi_promedio", "porcentaje_nubosidad")
  raw <- readr::read_csv(pro, col_select = tidyselect::all_of(campos),
                         show_col_types = FALSE)
  readr::stop_for_problems(raw)
  stopifnot(setequal(unique(raw$sensor), "Planet"))
  fecha <- as.Date(raw$fecha_captura, format = "%d/%m/%Y")
  stopifnot(!anyNA(fecha))
  usar <- is.finite(raw$ndvi_promedio) & is.finite(raw$porcentaje_nubosidad) &
    raw$porcentaje_nubosidad <= 20 & fecha >= as.Date("2025-04-01") &
    fecha <= as.Date("2025-10-31")
  obs <- data.frame(id = raw$ID_POLIGONO[usar],
                    dia = as.integer(format(fecha[usar], "%j")),
                    ndvi = raw$ndvi_promedio[usar])
  stopifnot(all(obs$id %in% d$ids))
  rejilla <- 91:304
  resumir <- function(id) {
    q <- obs[obs$id == id, ]
    diaria <- tapply(q$ndvi, q$dia, median)
    v <- as.numeric(diaria[as.character(rejilla)])
    movil <- vapply(seq_along(v), function(j) {
      valores <- v[max(1, j - 7):min(length(v), j + 7)]
      valores <- valores[is.finite(valores)]
      if (length(valores) >= 3) median(valores) else NA_real_
    }, numeric(1))
    curva <- if (sum(is.finite(movil)) >= 2) {
      approx(rejilla[is.finite(movil)], movil[is.finite(movil)],
             xout = rejilla, rule = 1)$y
    } else movil
    base <- if (any(is.finite(curva[rejilla <= 150]))) {
      median(curva[rejilla <= 150], na.rm = TRUE)
    } else NA_real_
    temporada <- which(rejilla >= 150 & is.finite(curva))
    integral <- pico <- inicio <- fin <- NA_real_
    if (length(temporada) && is.finite(base)) {
      pk <- temporada[which.max(curva[temporada])]
      pico <- curva[pk]
      umbral <- base + .5 * (pico - base)
      subida <- which(rejilla >= 150 & seq_along(rejilla) <= pk &
                        is.finite(curva) & curva >= umbral)
      bajada <- which(seq_along(rejilla) >= pk & is.finite(curva) & curva < umbral)
      if (length(subida)) {
        a <- subida[1]
        b <- if (length(bajada)) bajada[1] else length(rejilla)
        tramo <- curva[a:b]
        if (all(is.finite(tramo))) {
          integral <- sum(pmax(tramo - base, 0))
          inicio <- rejilla[a]
          fin <- rejilla[b]
        }
      }
    }
    list(resumen = data.frame(ID_POLIGONO = id, capturas = nrow(q),
      dias_observados = length(diaria), dias_movil = sum(is.finite(movil)),
      base = base, pico = pico, inicio_dia = inicio, fin_dia = fin,
      integral = integral),
      curva = data.frame(ID_POLIGONO = id, dia = rejilla, observado = v,
                         mediana_movil = movil, interpolado = curva))
  }
  resultados <- lapply(d$ids, resumir)
  d$planet <- do.call(rbind, lapply(resultados, `[[`, "resumen"))
  d$curvas <- do.call(rbind, lapply(resultados, `[[`, "curva"))
  d$fuentes <- c(d$fuentes, pro)
  d
}


# ======================================================================
# 04_contraste_k_y_distancias.R
# ======================================================================
# Etapa 4. Dos vecindades distintas: contraste satelital y cosechas conocidas.
distancia_km <- function(lon, lat, referencia_lon, referencia_lat) {
  r <- pi / 180
  a <- sin((referencia_lat - lat) * r / 2)^2 + cos(lat * r) *
    cos(referencia_lat * r) * sin((referencia_lon - lon) * r / 2)^2
  6371.0088 * 2 * asin(sqrt(pmin(1, pmax(0, a))))
}

contraste_k_y_distancias <- function(d) {
  puntos <- sf::st_as_sf(d$meta, coords = c("lon", "lat"), crs = 4326)
  xy <- sf::st_coordinates(sf::st_transform(puntos, 32614))
  metros <- as.matrix(dist(xy))
  k <- rep(NA_real_, length(d$ids))
  n_geo <- n_validas <- integer(length(d$ids))
  for (i in seq_along(d$ids)) {
    vecinas <- which(metros[i, ] > 0 & metros[i, ] < 1000)
    validas <- vecinas[is.finite(d$planet$integral[vecinas])]
    n_geo[i] <- length(vecinas)
    n_validas[i] <- length(validas)
    if (length(validas) >= 2 && is.finite(d$planet$integral[i])) {
      k[i] <- d$planet$integral[i] - median(d$planet$integral[validas])
    }
  }
  d$k <- k
  d$planet$vecinas_1km <- n_geo
  d$planet$vecinas_validas <- n_validas
  d$planet$K <- k
  # Conservar tambien el orden de operaciones de la matriz usada al entrenar.
  lat <- d$meta$lat * pi / 180
  lon <- d$meta$lon * pi / 180
  a <- sin(outer(lat, lat, "-") / 2)^2 + outer(cos(lat), cos(lat)) *
    sin(outer(lon, lon, "-") / 2)^2
  d$distancias <- matrix(6371.0088 * 2 * asin(sqrt(pmin(1, pmax(0, a)))),
                         length(d$ids), length(d$ids))
  diag(d$distancias) <- 0
  stopifnot(all(is.finite(d$distancias)))
  d
}


# ======================================================================
# 05_aprender_componente_lluvia.R
# ======================================================================
# Etapa 5. Seleccion de la representacion de lluvia y pendiente intramunicipal.
aprender_componente_lluvia <- function(d, tr) {
  x <- d$octubre
  g <- as.character(d$meta$municipio[tr])
  y <- d$y[tr]
  stopifnot(all(is.finite(y)), all(is.finite(x)))
  medias_y <- tapply(y, g, mean)
  yc <- y - as.numeric(medias_y[g])
  xc <- x[tr, , drop = FALSE]
  for (j in seq_len(ncol(x))) {
    medias_x <- tapply(xc[, j], g, mean)
    xc[, j] <- xc[, j] - as.numeric(medias_x[g])
  }
  correlaciones <- colSums(xc * yc) /
    sqrt(pmax(colSums(xc^2) * sum(yc^2), 1e-24))
  elegida <- which.max(abs(correlaciones))
  v <- x[, elegida]
  media <- mean(v[tr])
  escala <- sqrt(mean((v[tr] - media)^2))
  if (!is.finite(escala) || escala < 1e-12) escala <- 1
  z <- (v - media) / escala
  medias_z <- tapply(z[tr], g, mean)
  a <- z[tr] - as.numeric(medias_z[g])
  denominador <- sum(a^2)
  beta <- if (denominador > 1e-12) sum(a * yc) / denominador else 0
  list(variable = colnames(x)[elegida], beta = beta, mean = media, sd = escala,
       group_mean_y = medias_y, group_mean_z = medias_z,
       correlations = correlaciones, global_z = mean(z[tr]))
}


# ======================================================================
# 06_aprender_vecinos_y_correccion.R
# ======================================================================
# Etapa 6. MIX = media municipal + IDW20; correccion K sobre residuos OOF.
predecir_base_vecinos <- function(d, tr, consultas) {
  stopifnot(!length(intersect(tr, consultas)), all(is.finite(d$y[tr])))
  medias <- tapply(d$y[tr], d$meta$municipio[tr], mean)
  municipal <- as.numeric(medias[as.character(d$meta$municipio[consultas])])
  municipal[!is.finite(municipal)] <- mean(d$y[tr])
  idw <- vapply(consultas, function(i) {
    nn <- head(tr[order(d$distancias[i, tr], d$ids[tr])], 20)
    weighted.mean(d$y[nn], 1 / pmax(d$distancias[i, nn] * 1000, 1)^2)
  }, numeric(1))
  .5 * municipal + .5 * idw
}

crear_particiones_internas <- function(d, tr) {
  set.seed(2026101901L)
  datos <- data.frame(pos = tr, target = d$y[tr])
  folds <- rsample::vfold_cv(datos, v = 4, strata = target, breaks = 4, pool = .1)
  lapply(folds$splits, function(s) list(
    tr = rsample::analysis(s)$pos, va = rsample::assessment(s)$pos))
}

aprender_modelo <- function(d, tr = d$entrenamiento, particiones = NULL) {
  stopifnot(length(tr) >= 3, !anyDuplicated(tr),
            all(tr %in% d$entrenamiento), all(is.finite(d$y[tr])))
  j <- aprender_componente_lluvia(d, tr)
  if (is.null(particiones)) particiones <- crear_particiones_internas(d, tr)
  oof <- rep(NA_real_, length(tr))
  visitadas <- integer(length(tr))
  for (s in particiones) {
    stopifnot(!length(intersect(s$tr, s$va)), setequal(c(s$tr, s$va), tr))
    posiciones <- match(s$va, tr)
    oof[posiciones] <- predecir_base_vecinos(d, s$tr, s$va)
    visitadas[posiciones] <- visitadas[posiciones] + 1L
  }
  stopifnot(all(is.finite(oof)), all(visitadas == 1L))
  residuo <- d$y[tr] - oof
  validas <- is.finite(d$k[tr])
  mediana <- escala <- NA_real_
  beta <- 0
  n <- 0L
  if (sum(validas) >= 3) {
    mediana <- median(d$k[tr][validas])
    escala <- sd(d$k[tr][validas])
    if (is.finite(escala) && escala >= 1e-12) {
      a <- matrix((d$k[tr][validas] - mediana) / escala, ncol = 1)
      beta <- as.numeric(solve(crossprod(a) + diag(10, ncol(a)),
                                crossprod(a, residuo[validas])))
      n <- sum(validas)
    }
  }
  conocidas <- data.frame(ID_POLIGONO = d$ids[tr],
    municipio = d$meta$municipio[tr], lon = d$meta$lon[tr],
    lat = d$meta$lat[tr], y = d$y[tr])
  modelo <- list(type = "OCT_MIX_FINAL", version = "1.4.0",
    recipe = "0.5J_MO_PICK+0.5MIX_CORR", known = conocidas,
    J = j[c("variable", "beta", "mean", "sd", "group_mean_y", "group_mean_z")],
    municipal_means = tapply(d$y[tr], d$meta$municipio[tr], mean),
    global_y = mean(d$y[tr]), global_z = j$global_z,
    correction = list(beta = beta, median = mediana, sd = escala, n = n),
    inner_seed = 2026101901L, scope = "59 consultas fijas2025")
  list(modelo = modelo, oof = data.frame(ID_POLIGONO = d$ids[tr],
    real = d$y[tr], base_oof = oof, residuo = residuo, K = d$k[tr]),
    correlaciones = j$correlations, particiones = particiones)
}


# ======================================================================
# 07_predecir_y_exportar.R
# ======================================================================
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
  my <- as.numeric(j$group_mean_y[g])
  mz <- as.numeric(j$group_mean_z[g])
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
    componentes = data.frame(ID_POLIGONO = datos$ID_POLIGONO, J = lluvia,
      MUN = municipal, IDW20 = idw, K_correction = correccion,
      MIX_CORR = mezcla, K_available = validas))
}

exportar_resultados <- function(d, ajuste, resultado, salida) {
  saveRDS(ajuste$modelo, file.path(salida, "modelo_oct_mix.rds"))
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


# ======================================================================
# 08_comprobar_reproduccion.R
# ======================================================================
# Etapa 8. Las referencias solo se leen DESPUES de entrenar y predecir.
comprobar_reproduccion <- function(d, ajuste, resultado, carpeta_paquete) {
  ref <- file.path(carpeta_paquete, "referencias")
  esperado <- read.csv(file.path(ref, "predicciones_59_vigentes.csv"))
  entradas <- readRDS(file.path(ref, "entradas_59_vigentes.rds"))
  modelo <- readRDS(file.path(ref, "modelo_vigente.rds"))
  propias <- preparar_consultas(d)
  orden <- match(esperado$ID_POLIGONO, resultado$predicciones$ID_POLIGONO)
  stopifnot(!anyNA(orden), nrow(resultado$predicciones) == 59L)
  delta <- max(abs(esperado$RENDIMIENTO_T_HA -
                    resultado$predicciones$RENDIMIENTO_T_HA[orden]))
  i <- match(entradas$ID_POLIGONO, propias$ID_POLIGONO)
  stopifnot(!anyNA(i), identical(is.na(entradas$K), is.na(propias$K[i])),
    max(abs(as.matrix(entradas[, c("lon", "lat", "P", "H", "K")]) -
              as.matrix(propias[i, c("lon", "lat", "P", "H", "K")])),
        na.rm = TRUE) < 1e-12,
    isTRUE(all.equal(ajuste$modelo$J, modelo$J, tolerance = 1e-12)),
    isTRUE(all.equal(ajuste$modelo$correction, modelo$correction, tolerance = 1e-12)),
    identical(ajuste$modelo$known, modelo$known),
    identical(ajuste$modelo$municipal_means, modelo$municipal_means),
    identical(ajuste$modelo$global_y, modelo$global_y),
    delta < 1e-12)
  invertidas <- predecir_modelo(ajuste$modelo, propias[59:1, rev(names(propias))])
  stopifnot(max(abs(invertidas$predicciones$RENDIMIENTO_T_HA[59:1] -
                     resultado$predicciones$RENDIMIENTO_T_HA)) < 1e-12)
  rechaza <- function(datos) inherits(try(predecir_modelo(
    ajuste$modelo, datos), silent = TRUE), "try-error")
  mal <- propias; mal$ID_POLIGONO[2] <- mal$ID_POLIGONO[1]; stopifnot(rechaza(mal))
  mal <- propias; mal$H[1] <- 0; stopifnot(rechaza(mal))
  mal <- propias; mal$K[1] <- Inf; stopifnot(rechaza(mal))
  mal <- propias; mal$RENDIMIENTO_T_HA <- 0; stopifnot(rechaza(mal))
  mal <- propias; mal$ID_POLIGONO[1] <- modelo$known$ID_POLIGONO[1]
  stopifnot(rechaza(mal), rechaza(propias[, names(propias) != "P"]))
  mal <- propias; mal$municipio[1] <- "municipio incorrecto"
  stopifnot(inherits(try(predecir_modelo(ajuste$modelo, mal, propias),
                        silent = TRUE), "try-error"))
  mal <- propias; mal$lon[1] <- mal$lon[1] + .01
  stopifnot(inherits(try(predecir_modelo(ajuste$modelo, mal, propias),
                        silent = TRUE), "try-error"))
  list(estado = "PASS", parcelas = 59L, diferencia_maxima_prediccion = delta,
       parametros_y_entradas_reproducidos = TRUE, pruebas_rechazo = 8L,
       invariancia_orden = TRUE, K_conocidas = sum(is.finite(d$k[d$entrenamiento])),
       K_consultas = sum(is.finite(d$k[d$consultas])))
}


# ======================================================================
# 09_validacion_fuera_de_muestra.R
# ======================================================================
# Etapa 9. Reejecutar SOLO esta receta en 50 folds locales y 5 espaciales fijos.
validacion_fuera_de_muestra <- function(d, carpeta_paquete, salida) {
  ruta <- file.path(carpeta_paquete, "contratos")
  externos <- read.csv(file.path(ruta, "particiones_externas.csv"),
                       colClasses = "character")
  internos <- read.csv(file.path(ruta, "particiones_internas.csv"),
                       colClasses = "character")
  ix <- function(ids) {
    posiciones <- match(ids, d$ids)
    stopifnot(!anyNA(posiciones))
    posiciones
  }
  n <- table(d$meta$municipio[d$entrenamiento])
  q <- table(d$meta$municipio[d$consultas]) / length(d$consultas)
  pesos <- as.numeric(q[as.character(d$meta$municipio)] /
                        n[as.character(d$meta$municipio)])
  pesos[!is.finite(pesos)] <- 0
  evaluaciones <- lapply(unique(externos$particion), function(nombre) {
    z <- externos[externos$particion == nombre, ]
    tr <- ix(z$ID_POLIGONO[z$rol == "entrenamiento"])
    va <- ix(z$ID_POLIGONO[z$rol == "validacion"])
    stopifnot(!length(intersect(tr, va)), setequal(c(tr, va), d$entrenamiento))
    if (z$escenario[1] == "ESPACIAL_5") stopifnot(!length(intersect(
      z$grupo[z$rol == "entrenamiento"], z$grupo[z$rol == "validacion"])))
    sub <- internos[internos$particion == nombre, ]
    folds <- lapply(unique(sub$pliegue_interno), function(f) {
      a <- sub[sub$pliegue_interno == f, ]
      list(tr = ix(a$ID_POLIGONO[a$rol == "entrenamiento"]),
           va = ix(a$ID_POLIGONO[a$rol == "validacion"]))
    })
    ajuste <- aprender_modelo(d, tr, folds)
    # Las etiquetas de validacion no pueden cambiar lo aprendido.
    alterado <- d
    alterado$y[va] <- 1e9 + seq_along(va)
    stopifnot(identical(ajuste$modelo, aprender_modelo(alterado, tr, folds)$modelo))
    pred <- predecir_modelo(ajuste$modelo, preparar_consultas(d, va))$predicciones
    data.frame(particion = nombre, escenario = z$escenario[1],
      repeticion = z$repeticion[1], pliegue = z$pliegue[1],
      ID_POLIGONO = d$ids[va], municipio = d$meta$municipio[va],
      real = d$y[va], prediccion = pred$RENDIMIENTO_T_HA, peso = pesos[va])
  })
  oof <- do.call(rbind, evaluaciones)
  referencia <- read.csv(file.path(carpeta_paquete, "referencias/oof_vigente.csv"),
                         colClasses = c(particion = "character"))
  clave <- function(t) paste(t$particion, t$ID_POLIGONO, sep = "|")
  m <- match(clave(oof), clave(referencia))
  write.csv(oof, file.path(salida, "validacion_oof.csv"), row.names = FALSE)
  # La matriz de entrenamiento y la inferencia puntual usan haversine con
  # distinto orden de operaciones. Se admite solo redondeo numerico, 1e-10 t/ha.
  delta_oof <- max(abs(oof$prediccion - referencia$prediccion[m]))
  stopifnot(!anyNA(m), nrow(oof) == nrow(referencia),
            max(abs(oof$real - referencia$real[m])) == 0,
            max(abs(oof$peso - referencia$peso[m])) < 1e-12,
            delta_oof < 1e-10)
  jsonlite::write_json(list(estado = "PASS", folds_externos = 55L,
    filas_oof = nrow(oof), diferencia_maxima_oof = delta_oof,
    tolerancia_numerica_t_ha = 1e-10, pruebas_aislamiento_etiquetas = 55L),
    file.path(salida, "verificacion_oof.json"), auto_unbox = TRUE,
    pretty = TRUE, digits = 16)
  resumen <- do.call(rbind, lapply(split(oof, oof$escenario), function(z) {
    error <- z$prediccion - z$real
    repeticiones <- split(seq_len(nrow(z)), z$repeticion)
    rmse_repeticion <- vapply(repeticiones, function(i)
      sqrt(sum(z$peso[i] * error[i]^2) / sum(z$peso[i])), numeric(1))
    data.frame(escenario = z$escenario[1], parcelas_unicas = length(unique(z$ID_POLIGONO)),
      filas_oof = nrow(z), RMSE_media_repeticiones = mean(rmse_repeticion),
      RMSE_pooled = sqrt(sum(z$peso * error^2) / sum(z$peso)),
      MAE = sum(z$peso * abs(error)) / sum(z$peso))
  }))
  write.csv(oof, file.path(salida, "validacion_oof.csv"), row.names = FALSE)
  write.csv(resumen, file.path(salida, "validacion_metricas.csv"), row.names = FALSE)
  resumen
}

# Incertidumbre: proper aprende; calibracion fija el radio; validacion lo evalua.
calibrar_intervalos <- function(d, carpeta_paquete, salida) {
  ruta <- file.path(carpeta_paquete, "contratos")
  roles <- read.csv(file.path(ruta, "calibracion_roles.csv"), colClasses = "character")
  internos <- read.csv(file.path(ruta, "calibracion_interna.csv"), colClasses = "character")
  ix <- function(ids) {
    pos <- match(ids, d$ids)
    stopifnot(!anyNA(pos))
    pos
  }
  n <- table(d$meta$municipio[d$entrenamiento])
  q <- table(d$meta$municipio[d$consultas]) / length(d$consultas)
  peso <- as.numeric(q[as.character(d$meta$municipio)] / n[as.character(d$meta$municipio)])
  peso[!is.finite(peso)] <- 0
  filas <- lapply(unique(roles$particion), function(nombre) {
    z <- roles[roles$particion == nombre, ]
    proper <- ix(z$ID_POLIGONO[z$rol == "proper"])
    cal <- ix(z$ID_POLIGONO[z$rol == "calibracion"])
    va <- ix(z$ID_POLIGONO[z$rol == "validacion"])
    stopifnot(!length(intersect(proper, cal)), !length(intersect(proper, va)),
      !length(intersect(cal, va)), setequal(c(proper, cal, va), d$entrenamiento))
    sub <- internos[internos$particion == nombre, ]
    folds <- lapply(unique(sub$pliegue_interno), function(f) {
      a <- sub[sub$pliegue_interno == f, ]
      list(tr = ix(a$ID_POLIGONO[a$rol == "entrenamiento"]),
           va = ix(a$ID_POLIGONO[a$rol == "validacion"]))
    })
    ajuste <- aprender_modelo(d, proper, folds)
    alterado <- d
    alterado$y[c(cal, va)] <- 1e9
    stopifnot(identical(ajuste$modelo, aprender_modelo(alterado, proper, folds)$modelo))
    pred <- predecir_modelo(ajuste$modelo, preparar_consultas(d, c(cal, va)))$
      predicciones$RENDIMIENTO_T_HA
    pc <- pred[seq_along(cal)]
    pv <- pred[length(cal) + seq_along(va)]
    errores_cal <- abs(d$y[cal] - pc)
    rango <- ceiling((length(cal) + 1) * .8)
    stopifnot(rango <= length(cal))
    radio <- sort(errores_cal)[rango]
    data.frame(particion = nombre, escenario = z$escenario[1],
      ID_POLIGONO = d$ids[va], real = d$y[va], centro = pv,
      inferior = pv - radio, superior = pv + radio,
      cubierto = abs(pv - d$y[va]) <= radio, ancho = 2 * radio, peso = peso[va])
  })
  intervalos <- do.call(rbind, filas)
  ref <- read.csv(file.path(carpeta_paquete, "referencias/intervalos_vigentes.csv"),
                  colClasses = c(particion = "character"))
  clave <- function(t) paste(t$particion, t$ID_POLIGONO, sep = "|")
  i <- match(clave(intervalos), clave(ref))
  delta <- max(abs(as.matrix(intervalos[, c("centro", "inferior", "superior")]) -
                     as.matrix(ref[i, c("centro", "inferior", "superior")])))
  stopifnot(!anyNA(i), nrow(intervalos) == 414L, delta < 1e-10,
            identical(intervalos$cubierto, ref$cubierto[i]))
  resumen <- do.call(rbind, lapply(split(intervalos, intervalos$escenario), function(z)
    data.frame(escenario = z$escenario[1], filas = nrow(z),
      cobertura_ponderada = sum(z$peso * z$cubierto) / sum(z$peso),
      ancho_medio_ponderado = sum(z$peso * z$ancho) / sum(z$peso))))
  write.csv(intervalos, file.path(salida, "intervalos_validacion.csv"), row.names = FALSE)
  write.csv(resumen, file.path(salida, "cobertura_validacion.csv"), row.names = FALSE)
  jsonlite::write_json(list(estado = "PASS", particiones = 15L, intervalos = 414L,
    diferencia_maxima = delta, nominal = .8, pruebas_aislamiento = 15L,
    intervalos_para_full138_certificados = FALSE),
    file.path(salida, "verificacion_calibracion.json"), auto_unbox = TRUE,
    pretty = TRUE, digits = 16)
  resumen
}


# Coordinacion de las nueve etapas. No se instalan paquetes ni se sobreescriben salidas.
ejecutar_modelo <- function(carpeta_datos, salida, carpeta_paquete) {
  stopifnot(dir.exists(carpeta_datos), !file.exists(salida))
  dir.create(salida, recursive = TRUE)
  message("1/9 Unir registros y poligonos oficiales")
  d <- leer_y_unir_datos(carpeta_datos, carpeta_paquete)
  message("2/9 Extraer octubre 2022-2025")
  d <- extraer_lluvia_octubre(d)
  message("3/9 Preparar trayectoria Planet")
  d <- preparar_trayectoria_planet(d)
  message("4/9 Construir contraste K y distancias")
  d <- contraste_k_y_distancias(d)
  message("5-6/9 Aprender lluvia, vecinos y correccion con las 138 conocidas")
  ajuste <- aprender_modelo(d)
  message("7/9 Estimar las 59 consultas")
  registro <- preparar_consultas(d)
  resultado <- predecir_modelo(ajuste$modelo, registro, registro)
  message("8/9 Comprobar equivalencia con el modelo vigente")
  verificacion <- comprobar_reproduccion(d, ajuste, resultado, carpeta_paquete)
  message("9/9 Reproducir validacion local y espacial")
  metricas <- validacion_fuera_de_muestra(d, carpeta_paquete, salida)
  cobertura <- calibrar_intervalos(d, carpeta_paquete, salida)
  exportar_resultados(d, ajuste, resultado, salida)
  # Estos contratos contienen posiciones/roles; no rendimientos ni predicciones.
  contratos <- list.files(file.path(carpeta_paquete, "contratos"), full.names = TRUE)
  fuentes <- c(d$fuentes, contratos)
  write.csv(data.frame(archivo = fuentes, MD5 = unname(tools::md5sum(fuentes))),
             file.path(salida, "huellas_entradas.csv"), row.names = FALSE)
  jsonlite::write_json(verificacion, file.path(salida, "verificacion.json"),
                       auto_unbox = TRUE, pretty = TRUE, digits = 16)
  writeLines(capture.output(sessionInfo()), file.path(salida, "sessionInfo.txt"))
  print(metricas)
  print(cobertura)
  message("PASS: 59 predicciones reproducidas. Resultados: ", normalizePath(salida))
  invisible(list(datos = d, ajuste = ajuste, predicciones = resultado,
                 metricas = metricas, cobertura = cobertura))
}

# Entrada de linea de comandos del archivo integrado.
archivo_actual <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1])
paquete <- dirname(normalizePath(archivo_actual, mustWork = TRUE))
argumentos <- commandArgs(TRUE)
if (length(argumentos) != 2L) stop("Uso: Rscript modelo_completo.R CARPETA_DATOS CARPETA_SALIDA")
ejecutar_modelo(argumentos[1], argumentos[2], paquete)

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
  mapa <- read.csv(file.path(carpeta_paquete, "contratos/grupos_territoriales.csv"))
  stopifnot(!anyDuplicated(mapa$municipio), setequal(unique(meta$municipio), mapa$municipio))
  grupos <- setNames(as.character(mapa$grupo), mapa$municipio)
  list(mapa_grupos = grupos, ids = ids, tabla = t, meta = meta, poligonos = p,
       y = t$RENDIMIENTO_T_HA, entrenamiento = tr, consultas = u,
       carpeta_datos = carpeta_datos, fuentes = requeridos)
}

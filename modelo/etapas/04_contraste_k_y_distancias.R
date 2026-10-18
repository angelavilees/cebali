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

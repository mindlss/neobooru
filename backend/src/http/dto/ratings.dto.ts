export type SetRatingBodyDTO = {
    value: number;
};

export type RatingResultDTO = {
    ratingAvg: number;
    ratingCount: number;
    myRating: number | null;
};

export type RateMediaResponseDTO = {
    status: 'ok';
} & RatingResultDTO;
